import os
import zipfile
import subprocess
import shutil

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANDROID_DIR = os.path.join(ROOT_DIR, "android-tv")
BUILD_TOOLS = os.path.join(ROOT_DIR, "build-tools", "android", "android-13")
DIST_DIR = os.path.join(ROOT_DIR, "dist")
BIN_DIR = os.path.join(ANDROID_DIR, "bin")
GEN_DIR = os.path.join(ANDROID_DIR, "gen")
LIBS_DIR = os.path.join(ANDROID_DIR, "libs")
JDK_BIN = r"C:\Users\nidal\.tizen-extension-platform\server\sdktools\data\jdk\bin"

os.environ["JAVA_HOME"] = r"C:\Users\nidal\.tizen-extension-platform\server\sdktools\data\jdk"
os.environ["PATH"] = f"{JDK_BIN};{os.environ.get('PATH', '')}"

os.makedirs(DIST_DIR, exist_ok=True)
os.makedirs(BIN_DIR, exist_ok=True)
os.makedirs(GEN_DIR, exist_ok=True)

aapt2 = os.path.join(BUILD_TOOLS, "aapt2.exe")
android_jar = os.path.join(BUILD_TOOLS, "android.jar")
d8 = os.path.join(BUILD_TOOLS, "d8.bat")
zipalign = os.path.join(BUILD_TOOLS, "zipalign.exe")
javac = os.path.join(JDK_BIN, "javac.exe")
keytool = os.path.join(JDK_BIN, "keytool.exe")
java_bin = os.path.join(JDK_BIN, "java.exe")
apksigner_jar = os.path.join(BUILD_TOOLS, "lib", "apksigner.jar")

print("--- 1. Compiling Resources with AAPT2 ---")
compiled_res = os.path.join(BIN_DIR, "compiled_res.zip")
subprocess.run([aapt2, "compile", "--dir", os.path.join(ANDROID_DIR, "res"), "-o", compiled_res], check=True)

print("--- 2. Linking Manifest & Generating R.java ---")
unaligned_base_apk = os.path.join(BIN_DIR, "base_unaligned.apk")
if os.path.exists(unaligned_base_apk):
    os.remove(unaligned_base_apk)

subprocess.run([
    aapt2, "link",
    "-I", android_jar,
    "--manifest", os.path.join(ANDROID_DIR, "AndroidManifest.xml"),
    compiled_res,
    "--java", GEN_DIR,
    "-o", unaligned_base_apk,
    "--auto-add-overlay"
], check=True)

print("--- 3. Compiling Java Source Files ---")
classes_dir = os.path.join(BIN_DIR, "classes")
os.makedirs(classes_dir, exist_ok=True)

java_files = [os.path.join(r, f) for r, _, fs in os.walk(os.path.join(ANDROID_DIR, "src")) for f in fs if f.endswith(".java")] + [os.path.join(GEN_DIR, "com", "nidalplayer", "tv", "R.java")]
lib_jars = [os.path.join(LIBS_DIR, f) for f in os.listdir(LIBS_DIR) if f.endswith(".jar")]
classpath = ";".join([android_jar] + lib_jars)

subprocess.run([javac, "-encoding", "UTF-8", "-cp", classpath, "-d", classes_dir] + java_files, check=True)

print("--- 4. Generating classes.dex with D8 ---")
class_list = []
for root, _, files in os.walk(classes_dir):
    for f in files:
        if f.endswith(".class"):
            class_list.append(os.path.join(root, f))

# D8 needs all classes including those from libraries to generate a valid DEX.
# Windows has a short command-line limit; use an argument file for long inputs.
d8_args = ["--lib", android_jar, "--output", BIN_DIR] + class_list + lib_jars
d8_arg_file = os.path.join(BIN_DIR, "d8-inputs.txt")
with open(d8_arg_file, "w", encoding="utf-8") as arg_out:
    for arg in d8_args:
        arg_out.write(arg.replace('\\', '/') + '\n')
subprocess.run([d8, "@" + d8_arg_file], check=True)

print("--- 5. Repacking APK with Strict UNIX Forward Slash Paths ---")
unaligned_full_apk = os.path.join(BIN_DIR, "full_unaligned.apk")
if os.path.exists(unaligned_full_apk):
    os.remove(unaligned_full_apk)

with zipfile.ZipFile(unaligned_base_apk, 'r') as zin, zipfile.ZipFile(unaligned_full_apk, 'w', zipfile.ZIP_DEFLATED) as zout:
    # Copy existing base entries (resources.arsc MUST be uncompressed / ZIP_STORED for Android 11+ R+)
    for item in zin.infolist():
        buffer = zin.read(item.filename)
        clean_name = item.filename.replace('\\', '/')
        if clean_name == "resources.arsc" or clean_name.endswith(".arsc") or item.compress_type == zipfile.ZIP_STORED:
            zout.writestr(clean_name, buffer, compress_type=zipfile.ZIP_STORED)
        else:
            zout.writestr(clean_name, buffer, compress_type=zipfile.ZIP_DEFLATED)
    
    # Add classes.dex
    dex_path = os.path.join(BIN_DIR, "classes.dex")
    zout.write(dex_path, "classes.dex")
    
    # Add assets with strict forward slash paths
    assets_root = os.path.join(ANDROID_DIR, "assets")
    for root, _, files in os.walk(assets_root):
        for f in files:
            full_f = os.path.join(root, f)
            rel_f = os.path.relpath(full_f, ANDROID_DIR).replace('\\', '/')
            zout.write(full_f, rel_f)

print("--- 6. Aligning APK with zipalign ---")
aligned_apk = os.path.join(BIN_DIR, "aligned.apk")
if os.path.exists(aligned_apk):
    os.remove(aligned_apk)

subprocess.run([zipalign, "-p", "-f", "4", unaligned_full_apk, aligned_apk], check=True)

print("--- 7. Signing APK with apksigner (V1 + V2 + V3 Schemes) ---")
keystore = os.path.join(BIN_DIR, "nidal_tv_release.keystore")
if not os.path.exists(keystore):
    subprocess.run([
        keytool, "-genkeypair", "-v",
        "-keystore", keystore,
        "-storepass", "NidalPlayer2026!",
        "-alias", "nidal_tv",
        "-keypass", "NidalPlayer2026!",
        "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
        "-dname", "CN=Nidalplayer, OU=TV, O=NidalPlayer, L=Casablanca, ST=Casablanca, C=MA"
    ], check=True)

final_apk = os.path.join(DIST_DIR, "Nidalplayer-AndroidTV.apk")
beta_apk = os.path.join(DIST_DIR, "Nidalplayer-AndroidTV-Beta.apk")

if os.path.exists(beta_apk):
    os.remove(beta_apk)

if os.path.exists(final_apk):
    os.remove(final_apk)

subprocess.run([
    java_bin, "-jar", apksigner_jar, "sign",
    "--ks", keystore,
    "--ks-pass", "pass:NidalPlayer2026!",
    "--ks-key-alias", "nidal_tv",
    "--key-pass", "pass:NidalPlayer2026!",
    "--v1-signing-enabled", "true",
    "--v2-signing-enabled", "true",
    "--v3-signing-enabled", "true",
    "--out", final_apk,
    aligned_apk
], check=True)

print("--- 8. Verifying Signed APK ---")
subprocess.run([
    java_bin, "-jar", apksigner_jar, "verify",
    "-v", final_apk
], check=True)

# Also preserve in permanent apk/ folder so electron-builder never wipes it
perm_apk_dir = os.path.join(ROOT_DIR, "apk")
os.makedirs(perm_apk_dir, exist_ok=True)
shutil.copy2(final_apk, os.path.join(perm_apk_dir, "Nidalplayer-AndroidTV.apk"))

print("======================================================")
print("[SUCCESS] OFFICIAL MAIN RELEASE APK SIGNED & READY!")
print("Main Release APK:", final_apk, f"({os.path.getsize(final_apk) / (1024*1024):.2f} MB)")
print("Permanent Backup:", os.path.join(perm_apk_dir, "Nidalplayer-AndroidTV.apk"))
print("======================================================\n")
