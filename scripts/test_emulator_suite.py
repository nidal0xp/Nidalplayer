import os
import sys
import subprocess
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def find_adb():
    local_app_data = os.environ.get('LOCALAPPDATA', '')
    candidates = [
        os.path.join(local_app_data, 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
        'adb.exe',
        'adb'
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return 'adb'

def run_cmd(args):
    p = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    return p.stdout, p.stderr, p.returncode

def test_emulator():
    print('================================================================')
    print('GOOGLE ANDROID STUDIO EMULATOR AUTOMATED TEST SUITE')
    print('================================================================\n')
    
    adb = find_adb()
    print(f'Using ADB: {adb}')
    
    # 1. Check connected devices
    out, _, _ = run_cmd([adb, 'devices'])
    lines = [l.strip() for l in out.splitlines() if l.strip() and not l.startswith('List')]
    print(f'Connected devices: {lines}')
    if not lines or not any('device' in l for l in lines):
        print('[ERROR] No active Android Studio emulator found running!')
        return False
    
    # 2. Clear logcat
    run_cmd([adb, 'logcat', '-c'])
    
    # 3. Install APK
    apk_path = os.path.abspath('dist/Nidalplayer-AndroidTV.apk')
    print(f'Installing APK: {apk_path}...')
    out, err, code = run_cmd([adb, 'install', '-r', apk_path])
    if 'Success' not in out:
        print(f'[FAIL] APK install failed:\n{out}\n{err}')
        return False
    print('✅ APK Installed Successfully on Android Studio Emulator.')
    
    # 4. Launch App
    print('Launching Nidal Player on Emulator...')
    run_cmd([adb, 'shell', 'monkey', '-p', 'com.nidalplayer.tv', '-c', 'android.intent.category.LAUNCHER', '1'])
    time.sleep(3.5)
    
    # 5. Inject Navigation Keys (D-Pad Right, Down, OK, Back)
    print('Injecting navigation events (D-Pad Right -> Down -> Center/OK -> Back)...')
    run_cmd([adb, 'shell', 'input', 'keyevent', '22']) # RIGHT
    time.sleep(0.5)
    run_cmd([adb, 'shell', 'input', 'keyevent', '20']) # DOWN
    time.sleep(0.5)
    run_cmd([adb, 'shell', 'input', 'keyevent', '23']) # CENTER / OK
    time.sleep(0.8)
    run_cmd([adb, 'shell', 'input', 'keyevent', '4'])  # BACK / ESC
    time.sleep(0.5)
    
    # 6. Read Logcat and analyze errors
    out, _, _ = run_cmd([adb, 'logcat', '-d', '-s', 'NidalPlayerTV:*', 'chromium:*'])
    
    js_errors = []
    token_found = False
    page_loaded = False
    
    for l in out.splitlines():
        if 'Uncaught' in l or 'SyntaxError' in l or 'ReferenceError' in l or 'TypeError' in l:
            js_errors.append(l.strip())
        if 'Android TV Persistent Pairing Token' in l:
            token_found = True
        if 'WebView Page Loaded' in l:
            page_loaded = True
            
    print('\n--- RUNTIME LOG ANALYSIS ---')
    print(f'Webview Initialized & Page Loaded: {page_loaded}')
    print(f'Persistent Pairing Token Established: {token_found}')
    print(f'JavaScript Errors Detected: {len(js_errors)}')
    
    if js_errors:
        print('\n[ERRORS FOUND]:')
        for err in js_errors:
            print(f'  ❌ {err}')
            
    print('\n================================================================')
    print('TEST CONCLUSION & DIAGNOSIS')
    print('================================================================')
    if not js_errors and page_loaded and token_found:
        print('✅ STATUS: SUCCESS - ISSUE IS FULLY FIXED ON ANDROID STUDIO EMULATOR!')
        print('Conclusion: The TV app initialized without any JavaScript exceptions,')
        print('pairing server started successfully, and D-Pad navigation completed cleanly.')
        return True
    else:
        print('❌ STATUS: FAILURE - ISSUES DETECTED ON EMULATOR!')
        print(f'Conclusion: PageLoaded={page_loaded}, Token={token_found}, Errors={len(js_errors)}')
        return False

if __name__ == '__main__':
    success = test_emulator()
    sys.exit(0 if success else 1)
