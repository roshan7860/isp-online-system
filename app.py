from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from openpyxl import load_workbook
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from functools import wraps
import os, uuid

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY','change-this-secret-key')
DB = os.path.join(os.path.dirname(__file__),'database.xlsx')


def wb(): return load_workbook(DB)
def now(): return datetime.now().strftime('%Y-%m-%d %H:%M:%S')
def rows(sheet):
    w=wb(); s=w[sheet]; headers=[c.value for c in s[1]]
    return [dict(zip(headers,r)) for r in s.iter_rows(min_row=2, values_only=True) if any(v is not None for v in r)]
def append(sheet, data):
    w=wb(); s=w[sheet]; headers=[c.value for c in s[1]]; s.append([data.get(h,'') for h in headers]); w.save(DB)
def update_user(uid, **changes):
    w=wb(); s=w['Users']; headers=[c.value for c in s[1]]; idx={h:i for i,h in enumerate(headers)}
    for r in range(2,s.max_row+1):
        if str(s.cell(r,idx['UserID']+1).value)==str(uid):
            for k,v in changes.items(): s.cell(r,idx[k]+1).value=v
            w.save(DB); return True
    return False

def current_user():
    uid=session.get('uid')
    if not uid: return None
    u=next((x for x in rows('Users') if str(x['UserID'])==str(uid)),None)
    if not u or str(u['Status']).lower()!='enabled':
        session.clear(); return None
    return u

def login_required(f):
    @wraps(f)
    def wrapper(*a,**kw):
        u=current_user()
        if not u: return redirect(url_for('login'))
        return f(*a,**kw)
    return wrapper

def roles(*allowed):
    def deco(f):
        @wraps(f)
        def wrapper(*a,**kw):
            u=current_user()
            if not u: return redirect(url_for('login'))
            if u['Role'] not in allowed: return ('Forbidden',403)
            return f(*a,**kw)
        return wrapper
    return deco

@app.context_processor
def inject(): return {'me':current_user()}

@app.route('/')
def index(): return redirect(url_for('dashboard') if current_user() else url_for('login'))

@app.route('/login', methods=['GET','POST'])
def login():
    if request.method=='POST':
        username=request.form.get('username','').strip()
        password=request.form.get('password','')
        u=next((x for x in rows('Users') if str(x['Username']).lower()==username.lower()),None)
        if not u:
            flash('Invalid username or password.','danger'); return render_template('login.html')
        stored=str(u.get('PasswordHash') or '')
        # Seed/demo compatibility: accept password field if old DB has one; migrate to hash.
        if stored and check_password_hash(stored,password): ok=True
        elif str(u.get('Password') or '')==password: ok=True
        else: ok=False
        if not ok:
            flash('Invalid username or password.','danger'); return render_template('login.html')
        if str(u['Status']).lower()!='enabled':
            flash('Your account has been disabled by the Admin. Please contact the Admin.','danger'); return render_template('login.html')
        session['uid']=u['UserID']
        update_user(u['UserID'], LastLogin=now())
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/logout')
def logout(): session.clear(); return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard(): return render_template('dashboard.html')

@app.route('/users')
@roles('Admin','Manager')
def users():
    me=current_user(); allowed=['Manager'] if me['Role']=='Manager' else ['Manager','NTO']
    data=[u for u in rows('Users') if u['Role'] in allowed]
    return render_template('users.html', users=data, role=me['Role'])

@app.route('/users/add', methods=['POST'])
@roles('Admin','Manager')
def add_user():
    me=current_user(); role=request.form.get('role')
    if me['Role']=='Manager' and role!='NTO': return ('Forbidden',403)
    username=request.form.get('username','').strip()
    if any(str(u['Username']).lower()==username.lower() for u in rows('Users')):
        flash('Username already exists.','danger'); return redirect(url_for('users'))
    uid=str(uuid.uuid4())
    password=request.form.get('password','')
    append('Users', {'UserID':uid,'Username':username,'Name':request.form.get('name',''),'Phone':request.form.get('phone',''),'Role':role,'Status':'enabled','CreatedBy':me['UserID'],'CreatedAt':now(),'LastLogin':'','PasswordHash':generate_password_hash(password),'Password':''})
    flash('User created successfully.','success'); return redirect(url_for('users'))

@app.route('/users/<uid>/<action>', methods=['POST'])
@roles('Admin')
def user_action(uid,action):
    if action not in ('enable','disable','approve','reject'): return ('Bad action',400)
    status={'enable':'enabled','disable':'disabled','approve':'enabled','reject':'rejected'}[action]
    update_user(uid, Status=status)
    if action=='disable':
        # In an active session the next request logs the user out; real-time websocket can be added later.
        pass
    flash('User status updated.','success'); return redirect(url_for('users'))

@app.route('/bundle', methods=['GET','POST'])
@login_required
def bundle():
    me=current_user()
    if request.method=='POST':
        append('Bundles',{'BundleID':str(uuid.uuid4()),'NTOUserID':me['UserID'],'Field1':request.form.get('field1',''),'Field2':request.form.get('field2',''),'Status':'Pending','CreatedAt':now(),'ApprovedBy':'','ApprovedAt':''})
        flash('Bundle submitted and is Pending approval.','success'); return redirect(url_for('bundle'))
    mine=[b for b in rows('Bundles') if str(b['NTOUserID'])==str(me['UserID'])] if me['Role']=='NTO' else rows('Bundles')
    return render_template('bundle.html', bundles=mine)

@app.route('/bundle/<bid>/<action>', methods=['POST'])
@roles('Admin','Manager')
def bundle_action(bid,action):
    if action not in ('approve','reject'): return ('Bad action',400)
    w=wb(); s=w['Bundles']; headers=[c.value for c in s[1]]; idx={h:i+1 for i,h in enumerate(headers)}
    for r in range(2,s.max_row+1):
        if str(s.cell(r,idx['BundleID']).value)==str(bid):
            s.cell(r,idx['Status']).value='Approved' if action=='approve' else 'Rejected'
            s.cell(r,idx['ApprovedBy']).value=current_user()['UserID']; s.cell(r,idx['ApprovedAt']).value=now(); w.save(DB); break
    flash('Bundle status updated.','success'); return redirect(url_for('bundle'))

@app.route('/sales')
@login_required
def sales():
    me=current_user(); data=rows('SalesReport')
    if me['Role']=='NTO': data=[x for x in data if str(x['UserID'])==str(me['UserID'])]
    return render_template('sales.html', sales=data)

@app.route('/complaints', methods=['GET','POST'])
@login_required
def complaints():
    me=current_user()
    if request.method=='POST':
        append('Complaints',{'ComplaintID':str(uuid.uuid4()),'UserID':me['UserID'],'Subject':request.form.get('subject',''),'Description':request.form.get('description',''),'Status':'Open','CreatedAt':now(),'ResolvedBy':'','ResolvedAt':''})
        flash('Complaint submitted.','success'); return redirect(url_for('complaints'))
    data=rows('Complaints')
    if me['Role']=='NTO': data=[x for x in data if str(x['UserID'])==str(me['UserID'])]
    return render_template('complaints.html', complaints=data)

@app.route('/api/me')
@login_required
def api_me(): return jsonify(current_user())

# Add missing PasswordHash/Password columns to older database automatically.
def ensure_columns():
    w=wb(); s=w['Users']; headers=[c.value for c in s[1]]
    changed=False
    for col in ('PasswordHash','Password'):
        if col not in headers: s.cell(1,s.max_column+1).value=col; changed=True
    if changed: w.save(DB)
    # Create default admin only if there are no users.
    if len(rows('Users'))==0:
        append('Users', {'UserID':str(uuid.uuid4()),'Username':'admin','Name':'System Admin','Phone':'','Role':'Admin','Status':'enabled','CreatedBy':'system','CreatedAt':now(),'LastLogin':'','PasswordHash':generate_password_hash('Admin@12345'),'Password':''})

if __name__=='__main__':
    ensure_columns(); app.run(host='0.0.0.0',port=int(os.environ.get('PORT',5000)),debug=False)
