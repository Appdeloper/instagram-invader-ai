import os
import io
from flask import Flask, request, render_template, send_file, jsonify
from flask_cors import CORS
from PIL import Image
from image_processor import composite_images, download_font

app = Flask(__name__)
CORS(app)

# Configure maximum upload size to 12MB
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'heic'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/generate', methods=['POST'])
def generate():
    # 1. Validation Checks
    if 'portrait' not in request.files:
        return jsonify({'error': 'Missing portrait image'}), 400
        
    portrait_file = request.files['portrait']
    if portrait_file.filename == '':
        return jsonify({'error': 'No selected portrait file'}), 400
        
    if not allowed_file(portrait_file.filename):
        return jsonify({'error': 'Invalid portrait image format. Supported formats: PNG, JPG, JPEG, WEBP'}), 400

    profile_file = request.files.get('profile')
    profile_has_file = profile_file and profile_file.filename != ''
    if profile_has_file and not allowed_file(profile_file.filename):
        return jsonify({'error': 'Invalid profile image format. Supported formats: PNG, JPG, JPEG, WEBP'}), 400

    # 2. Extract Options
    tear_style = request.form.get('tear_style', 'circle')
    if tear_style not in ['circle', 'vertical', 'horizontal', 'diagonal', 'profile_breakout']:
        tear_style = 'circle'
        
    try:
        intensity = float(request.form.get('intensity', 1.0))
    except ValueError:
        intensity = 1.0
        
    meme_text = request.form.get('meme_text', "Hi, I just invaded your Instagram 😂")
    theme = request.form.get('theme', 'dark')
    if theme not in ['light', 'dark']:
        theme = 'dark'

    resolution = request.form.get('resolution', '1080')
    target_w = 2160 if resolution == '4k' else 1080

    # 3. Read Images into PIL
    try:
        portrait_img = Image.open(portrait_file.stream)
        portrait_img.load() # Load image data
    except Exception as e:
        return jsonify({'error': f'Failed to parse portrait image: {str(e)}'}), 400
        
    profile_img = None
    if profile_has_file:
        try:
            profile_img = Image.open(profile_file.stream)
            profile_img.load() # Load image data
        except Exception as e:
            return jsonify({'error': f'Failed to parse profile image: {str(e)}'}), 400

    # 4. Run Processing Pipeline
    try:
        output_img = composite_images(
            portrait_img=portrait_img,
            profile_img=profile_img,
            style=tear_style,
            intensity=intensity,
            meme_text=meme_text,
            theme=theme,
            target_w=target_w
        )
        
        # Save output to memory
        img_io = io.BytesIO()
        output_img.save(img_io, 'PNG', quality=95)
        img_io.seek(0)
        
        return send_file(img_io, mimetype='image/png', as_attachment=True, download_name='instagram_invader.png')
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Image processing error: {str(e)}'}), 500

def free_port(port):
    """Attempt to terminate any process listening on the specified port on Windows."""
    import subprocess
    import os
    try:
        # On Windows, use netstat to find the process ID (PID) listening on the port
        cmd = f"netstat -ano | findstr :{port}"
        output = subprocess.check_output(cmd, shell=True).decode('utf-8', errors='ignore')
        pids = set()
        for line in output.splitlines():
            line = line.strip()
            if "LISTENING" in line:
                parts = line.split()
                # The PID is the last column
                pid = parts[-1]
                pids.add(pid)
        for pid in pids:
            print(f"Terminating process with PID {pid} listening on port {port}...")
            subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            import time
            time.sleep(0.5)
    except Exception as e:
        print(f"Warning: Could not free port {port}: {e}")

def find_free_port(start_port=5000, max_port=5100):
    """Scan ports starting from start_port and return the first free one."""
    import socket
    for port in range(start_port, max_port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('0.0.0.0', port))
                return port
            except OSError:
                continue
    return start_port

if __name__ == '__main__':
    # Make sure font is downloaded on startup
    download_font()
    
    # Check if we are running as the main process (not the reloader child)
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        print("Starting Instagram Invader AI Server setup...")
        # Try to free port 5000 to prevent Address Already in Use listen errors
        free_port(5000)
        
    # Get port from environment or scan for a free one
    port_env = os.environ.get('FLASK_RUN_PORT')
    if port_env:
        port = int(port_env)
    else:
        port = find_free_port(5000)
        # Store it so the Werkzeug reloader child uses the exact same port
        os.environ['FLASK_RUN_PORT'] = str(port)
        
    print(f"\n==================================================")
    print(f" * Server starting on http://127.0.0.1:{port}")
    print(f" * Open this URL in your web browser!")
    print(f"==================================================\n")
    
    # Run the server
    app.run(host='0.0.0.0', port=port, debug=True)

