import os
import io
from flask import Flask, request, render_template, send_file, jsonify
from PIL import Image
from image_processor import composite_images, download_font

app = Flask(__name__)

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
    if 'profile' not in request.files:
        return jsonify({'error': 'Missing Instagram profile image'}), 400
        
    portrait_file = request.files['portrait']
    profile_file = request.files['profile']
    
    if portrait_file.filename == '' or profile_file.filename == '':
        return jsonify({'error': 'No selected files'}), 400
        
    if not (allowed_file(portrait_file.filename) and allowed_file(profile_file.filename)):
        return jsonify({'error': 'Invalid image format. Supported formats: PNG, JPG, JPEG, WEBP'}), 400

    # 2. Extract Options
    tear_style = request.form.get('tear_style', 'circle')
    if tear_style not in ['circle', 'vertical', 'horizontal', 'diagonal']:
        tear_style = 'circle'
        
    try:
        intensity = float(request.form.get('intensity', 1.0))
    except ValueError:
        intensity = 1.0
        
    meme_text = request.form.get('meme_text', "Hi, I just invaded your Instagram 😂")
    theme = request.form.get('theme', 'dark')
    if theme not in ['light', 'dark']:
        theme = 'dark'

    # 3. Read Images into PIL
    try:
        portrait_img = Image.open(portrait_file.stream)
        portrait_img.load() # Load image data
    except Exception as e:
        return jsonify({'error': f'Failed to parse portrait image: {str(e)}'}), 400
        
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
            theme=theme
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

if __name__ == '__main__':
    # Make sure font is downloaded on startup
    download_font()
    
    # Run the server on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
