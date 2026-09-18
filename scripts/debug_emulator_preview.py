import os
import sys
import subprocess
import time

adb = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Android', 'Sdk', 'platform-tools', 'adb.exe')

print('--- Clearing logcat ---')
subprocess.run([adb, 'logcat', '-c'])

print('--- Launching App ---')
subprocess.run([adb, 'shell', 'monkey', '-p', 'com.nidalplayer.tv', '-c', 'android.intent.category.LAUNCHER', '1'])
time.sleep(3)

print('--- Navigating to Live TV & Clicking Channel ---')
# Press DOWN to select first category/shelf, RIGHT to select channel, ENTER/OK to click
subprocess.run([adb, 'shell', 'input', 'keyevent', '20']) # DOWN
time.sleep(0.5)
subprocess.run([adb, 'shell', 'input', 'keyevent', '22']) # RIGHT
time.sleep(0.5)
subprocess.run([adb, 'shell', 'input', 'keyevent', '23']) # OK (1st OK)
time.sleep(2)

print('--- Capturing Logcat ---')
p = subprocess.run([adb, 'logcat', '-d'], capture_output=True, text=True, encoding='utf-8', errors='ignore')
for line in p.stdout.splitlines():
    if any(k in line for k in ['NidalPlayer', 'chromium', 'Console', 'ExoPlayer', 'PlayerActivity', 'MediaPlayer', 'VideoView', 'media']):
        print(line)
