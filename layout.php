<?php require_once __DIR__.'/config/config.php';
function layout_start($title,$mode='isp'){
 $flash=flash_get();
 if($mode==='super') need_super(); else need_isp();
?>
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?=e($title)?> — Global Net</title><link rel="stylesheet" href="../assets/app.css"></head><body>
<div class="app"><aside class="side"><div class="logo"><span class="logo-image"><img src="../assets/global_net_logo.jpg" alt="Global Net"></span><span class="brand-text">Global Net</span></div><nav class="nav">
<?php if($mode==='super'):?>
<div class="nav-title">Platform</div><a href="dashboard.php">▦ <span class="nav-text">Overview</span></a><a href="isps.php">◉ <span class="nav-text">ISP Companies</span></a><a href="../auth/logout.php" class="logout">↪ <span class="nav-text">Sign out</span></a>
<?php else:?>
<div class="nav-title">Hotspot Management</div><a href="dashboard.php">▦ <span class="nav-text">Dashboard</span></a><a href="hotspot_users.php">◎ <span class="nav-text">Hotspot Users</span></a><a href="packages.php">◇ <span class="nav-text">Hotspot Packages</span></a><a href="vouchers.php">▣ <span class="nav-text">Voucher Cards</span></a><a href="card_design.php">🎨 <span class="nav-text">Card Design</span></a><a href="hotspot_login_design.php">📱 <span class="nav-text">Login Page Design</span></a><a href="routers.php">⌁ <span class="nav-text">MikroTik</span></a><a href="usage.php">◌ <span class="nav-text">Usage & Quota</span></a><a href="payments.php">₿ <span class="nav-text">Payments</span></a><div class="nav-title">System</div><a href="../auth/logout.php" class="logout">↪ <span class="nav-text">Sign out</span></a>
<?php endif;?></nav></aside><main class="content"><div class="topbar"><div><h1><?=e($title)?></h1><div class="muted"><?php echo $mode==='super'?'Multi-tenant ISP platform':e($_SESSION['isp_name']??'ISP'); ?></div></div><div class="user-chip"><span class="avatar"><?=strtoupper(substr($mode==='super'?($_SESSION['super_name']??'S'):($_SESSION['isp_user_name']??'I'),0,1))?></span><span><?=e($mode==='super'?($_SESSION['super_name']??'Super Admin'):($_SESSION['isp_user_name']??'ISP User'))?></span></div></div><?php if($flash):?><div class="alert <?=e($flash[1])?>"><?=e($flash[0])?></div><?php endif;
}
function layout_end(){echo '</main></div></body></html>';}
