#!/usr/bin/env python3
"""
VM Test Simulation - Validates ARM64 browser setup from scratch
Simulates what would happen in a fresh VM environment
"""

import subprocess
import os
import sys
import tempfile
import shutil
from pathlib import Path

def run_command(cmd, description, check_output=True):
    """Run command and capture result"""
    print(f"\n🔍 {description}")
    print(f"📝 Command: {cmd}")
    
    try:
        if isinstance(cmd, str):
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        else:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
        print(f"✅ Exit code: {result.returncode}")
        if result.stdout:
            print(f"📤 STDOUT: {result.stdout[:200]}...")
        if result.stderr:
            print(f"⚠️  STDERR: {result.stderr[:200]}...")
            
        if check_output and result.returncode != 0:
            return False, f"Command failed with exit code {result.returncode}"
        return True, result.stdout + result.stderr
        
    except subprocess.TimeoutExpired:
        return False, "Command timed out"
    except Exception as e:
        return False, f"Exception: {e}"

def check_prerequisites():
    """Check if all prerequisites are available"""
    print("\n🔧 CHECKING PREREQUISITES")
    print("=" * 50)
    
    issues = []
    
    # Check Node.js
    success, output = run_command("node --version", "Check Node.js version")
    if not success:
        issues.append("❌ Node.js not found - run: sudo apt install nodejs")
    else:
        print(f"✅ Node.js: {output.strip()}")
    
    # Check npm
    success, output = run_command("npm --version", "Check npm version") 
    if not success:
        issues.append("❌ npm not found - run: sudo apt install npm")
    else:
        print(f"✅ npm: {output.strip()}")
    
    # Check Python3
    success, output = run_command("python3 --version", "Check Python3 version")
    if not success:
        issues.append("❌ Python3 not found - run: sudo apt install python3")
    else:
        print(f"✅ Python3: {output.strip()}")
    
    # Check Chromium
    success, output = run_command("chromium-browser --version", "Check Chromium version")
    if not success:
        issues.append("❌ Chromium not found - run: sudo apt install chromium-browser")
    else:
        print(f"✅ Chromium: {output.strip()}")
    
    return issues

def simulate_fresh_install():
    """Simulate what happens in a fresh VM"""
    print("\n🚀 SIMULATING FRESH VM INSTALL")
    print("=" * 50)
    
    issues = []
    
    # Create a temp directory to simulate fresh clone
    with tempfile.TemporaryDirectory() as temp_dir:
        test_dir = Path(temp_dir) / "claude-arm64-browser"
        test_dir.mkdir()
        
        print(f"📁 Created test directory: {test_dir}")
        
        # Copy essential files to simulate git clone
        current_dir = Path(__file__).parent
        essential_files = [
            "index.js",
            "package.json", 
            "arm64_browser.py",
            "simple_browser.py",
            "README.md"
        ]
        
        for file in essential_files:
            src = current_dir / file
            if src.exists():
                shutil.copy2(src, test_dir / file)
                print(f"✅ Copied {file}")
            else:
                issues.append(f"❌ Missing essential file: {file}")
        
        # Change to test directory
        os.chdir(test_dir)
        print(f"📂 Changed to: {os.getcwd()}")
        
        # Test npm install
        if (test_dir / "package.json").exists():
            success, output = run_command("npm install", "Install npm dependencies")
            if not success:
                issues.append(f"❌ npm install failed: {output}")
        else:
            issues.append("❌ package.json missing - cannot run npm install")
        
        # Test the one-liner
        one_liner = "python3 -c \"import sys; sys.path.append('.'); import arm64_browser; print('✅ ARM64 Browser Works!' if 'error' not in arm64_browser.navigate('https://example.com').lower() else '❌ Failed')\""
        
        print(f"\n🧪 Testing one-liner from: {os.getcwd()}")
        success, output = run_command(one_liner, "Test one-liner verification", check_output=False)
        
        if "✅ ARM64 Browser Works!" in output:
            print("🎉 ONE-LINER TEST PASSED!")
        elif "❌ Failed" in output:
            issues.append("❌ One-liner test failed - browser automation not working")
        else:
            issues.append(f"❌ One-liner unexpected output: {output}")
        
        # Test cross-session usage simulation
        cross_session_test = f"""
import sys
sys.path.append('{test_dir}')
import arm64_browser
result = arm64_browser.navigate('https://httpbin.org/get')
print('Cross-session test:', 'SUCCESS' if 'error' not in result.lower() else 'FAILED')
"""
        
        success, output = run_command(f"python3 -c \"{cross_session_test}\"", "Test cross-session usage")
        if "SUCCESS" not in output:
            issues.append(f"❌ Cross-session test failed: {output}")
    
    return issues

def validate_documentation():
    """Check if documentation matches reality"""
    print("\n📚 VALIDATING DOCUMENTATION")
    print("=" * 50)
    
    issues = []
    
    # Check if README.md exists and has required sections
    readme_path = Path("README.md")
    if not readme_path.exists():
        issues.append("❌ README.md missing")
        return issues
    
    readme_content = readme_path.read_text()
    
    required_sections = [
        "### Installation",
        "### ⚡ Quick Test (One-Liner)", 
        "git clone https://github.com/nfodor/claude-arm64-browser",
        "npm install",
        "arm64_browser.navigate"
    ]
    
    for section in required_sections:
        if section not in readme_content:
            issues.append(f"❌ README missing: {section}")
        else:
            print(f"✅ README contains: {section}")
    
    return issues

def main():
    """Run complete VM simulation test"""
    print("🖥️  VM INSTALLATION TEST SIMULATION")
    print("=" * 60)
    print("This simulates what would happen in a fresh VM environment")
    
    all_issues = []
    
    # Check prerequisites
    prereq_issues = check_prerequisites()
    all_issues.extend(prereq_issues)
    
    # Validate documentation
    doc_issues = validate_documentation() 
    all_issues.extend(doc_issues)
    
    # Simulate fresh install
    install_issues = simulate_fresh_install()
    all_issues.extend(install_issues)
    
    # Summary
    print("\n📊 TEST SUMMARY")
    print("=" * 50)
    
    if not all_issues:
        print("🎉 ALL TESTS PASSED! Ready for VM deployment")
        print("✅ Prerequisites available")
        print("✅ Documentation complete")
        print("✅ Installation process works")
        print("✅ One-liner verification works")
        print("✅ Cross-session usage works")
    else:
        print(f"⚠️  FOUND {len(all_issues)} ISSUES:")
        for i, issue in enumerate(all_issues, 1):
            print(f"{i}. {issue}")
        
        print("\n🔧 RECOMMENDED FIXES:")
        if any("Node.js" in issue for issue in all_issues):
            print("- sudo apt update && sudo apt install nodejs npm")
        if any("Chromium" in issue for issue in all_issues):
            print("- sudo apt install chromium-browser")
        if any("Python3" in issue for issue in all_issues):
            print("- sudo apt install python3")
    
    return len(all_issues) == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)