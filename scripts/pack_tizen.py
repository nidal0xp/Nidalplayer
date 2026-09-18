import os
import sys
import subprocess
import shutil

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TIZEN_SRC = os.path.join(ROOT_DIR, "tizen-app")
DIST_DIR = os.path.join(ROOT_DIR, "dist")
USERWIDGET_DIST = os.path.join(DIST_DIR, "userwidget")
TIZEN_PERM = os.path.join(ROOT_DIR, "tizen")
USERWIDGET_PERM = os.path.join(TIZEN_PERM, "userwidget")

TIZEN_BAT = r"C:\Users\nidal\.tizen-extension-platform\server\sdktools\data\tools\ide\bin\tizen.bat"
SDB_EXE = r"C:\Users\nidal\.tizen-extension-platform\server\sdktools\data\tools\sdb.exe"
TV_IP = "192.168.11.100"
TV_TARGET = "192.168.11.100:26101"
PKG_ID = "NpTvPlayer.Nidalplayer"

os.makedirs(DIST_DIR, exist_ok=True)
os.makedirs(USERWIDGET_DIST, exist_ok=True)
os.makedirs(TIZEN_PERM, exist_ok=True)
os.makedirs(USERWIDGET_PERM, exist_ok=True)

print("======================================================")
print(" PACKAGING & SIGNING SAMSUNG TIZEN OS WGT PACKAGE")
print("======================================================")

# 1. Sign and package using Tizen CLI and NidalProfile
built_wgt = os.path.join(TIZEN_SRC, "Nidalplayer.wgt")
if os.path.exists(built_wgt):
    try:
        os.remove(built_wgt)
    except Exception:
        pass

print("--- 1. Packaging & Signing with NidalProfile ---")
cmd_pkg = [TIZEN_BAT, "package", "-t", "wgt", "-s", "NidalProfile", "--", TIZEN_SRC]
res = subprocess.run(cmd_pkg, capture_output=True, text=True)
if res.returncode != 0:
    print(f"[ERROR] tizen package failed: {res.stderr}\n{res.stdout}")
    sys.exit(1)
print(res.stdout.strip())

if not os.path.exists(built_wgt):
    print("[ERROR] Built package not found at:", built_wgt)
    sys.exit(1)

# 2. Distribute to dist/ and tizen/ and USB userwidget
print("--- 2. Generating Samsung TV USB userwidget & Release WGTs ---")
target_wgt_dist = os.path.join(DIST_DIR, "Nidalplayer-Tizen-5.8.0.wgt")
target_wgt_perm = os.path.join(TIZEN_PERM, "Nidalplayer-Tizen-5.8.0.wgt")

shutil.copy2(built_wgt, target_wgt_dist)
shutil.copy2(built_wgt, os.path.join(USERWIDGET_DIST, "Nidalplayer.wgt"))
shutil.copy2(built_wgt, os.path.join(DIST_DIR, "Nidalplayer-SamsungTV.wgt"))
shutil.copy2(built_wgt, os.path.join(DIST_DIR, "Nidalplayer.wgt"))

print("--- 3. Safeguarding permanent copies in tizen/ ---")
shutil.copy2(built_wgt, target_wgt_perm)
shutil.copy2(built_wgt, os.path.join(USERWIDGET_PERM, "Nidalplayer.wgt"))
shutil.copy2(built_wgt, os.path.join(TIZEN_PERM, "Nidalplayer-SamsungTV.wgt"))
shutil.copy2(built_wgt, os.path.join(TIZEN_PERM, "Nidalplayer.wgt"))

size_mb = os.path.getsize(target_wgt_dist) / (1024 * 1024)
print(f"[SUCCESS] Samsung Tizen WGT built and signed! ({size_mb:.2f} MB)")
print(f"  - Dist WGT: {target_wgt_dist}")
print(f"  - USB Folder: {USERWIDGET_DIST}/Nidalplayer.wgt")
print(f"  - Permanent Backup: {target_wgt_perm}")

# 4. Optional / Default: Deploy directly to TV if requested or flag passed
if "--deploy" in sys.argv or "--install" in sys.argv or os.environ.get("DEPLOY_TV") == "1":
    print("\n--- 4. Deploying directly to Samsung Smart TV (192.168.11.100) ---")
    import urllib.request
    
    # 4a. Close existing app instance if running
    try:
        req = urllib.request.Request(f"http://{TV_IP}:8001/api/v2/applications/{PKG_ID}", method="DELETE")
        with urllib.request.urlopen(req, timeout=3) as resp:
            print("[INFO] Terminated existing app instance on TV:", resp.status)
    except Exception as e:
        print("[INFO] App was not running or close returned:", e)

    # 4b. SDB connect
    import time
    res_conn = subprocess.run([SDB_EXE, "connect", TV_TARGET], capture_output=True, text=True)
    print("[INFO] SDB connect:", (res_conn.stdout + res_conn.stderr).strip())
    time.sleep(2)

    # 4c. Uninstall old package to purge web cache completely
    print("[INFO] Purging old package & cache from TV...")
    subprocess.run([TIZEN_BAT, "uninstall", "-s", TV_TARGET, "-p", PKG_ID], capture_output=True)

    # 4d. Install fresh package
    print("[INFO] Installing fresh signed package on TV...")
    cmd_inst = [TIZEN_BAT, "install", "-s", TV_TARGET, "-n", built_wgt]
    res_inst = subprocess.run(cmd_inst, capture_output=True, text=True)
    print(res_inst.stdout.strip())
    if res_inst.returncode == 0:
        print("[SUCCESS] Application installed successfully on Samsung TV!")
        # 4e. Run
        cmd_run = [TIZEN_BAT, "run", "-s", TV_TARGET, "-p", PKG_ID]
        res_run = subprocess.run(cmd_run, capture_output=True, text=True)
        print(res_run.stdout.strip())
        print("[SUCCESS] Application launched on Samsung TV!")
    else:
        print(f"[WARN] TV install returned code {res_inst.returncode}: {res_inst.stderr}")
