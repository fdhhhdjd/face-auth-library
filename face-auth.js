// face-auth.js
class FaceAuth {
    constructor(options = {}) {
        // Default configuration
        this.config = {
            detectionInterval: 200,
            progressStep: 1,
            progressIntervalTime: 100,
            minFaceSize: 0.3,
            maxFaceSize: 0.6,
            centerThreshold: 0.15,
            warningThreshold: 0.25,
            
            // CÁC OPTION MÀU SẮC MỚI
            primaryColor: '#3a86ff',      // Màu chính (xanh dương)
            successColor: '#2ed573',      // Màu thành công (xanh lá)
            warningColor: '#ffa502',      // Màu cảnh báo (cam)
            errorColor: '#ff4757',        // Màu lỗi (đỏ)
            textColor: '#ffffff',         // Màu chữ chính
            subtitleColor: '#b0b0b0',     // Màu chữ phụ
            backgroundColor: '#1e1e1e',   // Màu nền
            overlayColor: 'rgba(0, 0, 0, 0.8)', // Màu overlay
            
            onCapture: null,
            onClose: null,
            onError: null,
            ...options
        };

        // State management
        this.stream = null;
        this.progressInterval = null;
        this.progress = 0;
        this.isCentered = false;
        this.isCapturing = false;
        this.faceDetectionModel = null;
        this.detectionInterval = null;
        this.voiceEnabled = true;
        this.isSpeaking = false;
        this.foreignObjectDetected = false;
        this.faceValidationChecks = {
            hasBothEyes: false,
            hasNose: false,
            hasMouth: false,
            isFullFace: false
        };

        // Animation frame ID for cleanup
        this.animationFrameId = null;

        // Check dependencies
        if (typeof faceLandmarksDetection === 'undefined') {
            throw new Error('FaceLandmarksDetection is required. Please include it before FaceAuth.');
        }
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js is required. Please include it before FaceAuth.');
        }

        this.initDOM();
        this.initEventListeners();
        this.initVoice();
    }

    initDOM() {
        // Luôn xóa DOM cũ trước khi tạo mới
        this.removeDOM();

        // Create DOM structure if not exists
        if (!document.getElementById('faceAuthOverlay')) {
            this.createPopupStructure();
        }

        // Cache DOM elements
        this.cacheDOMElements();
    }

    createPopupStructure() {
        const overlay = document.createElement('div');
        overlay.className = 'face-auth-overlay';
        overlay.id = 'faceAuthOverlay';
        
        const popup = document.createElement('div');
        popup.className = 'face-auth-popup';
        popup.id = 'faceAuthPopup';
        popup.innerHTML = `
            <div class="face-auth-header">
                <div>
                    <div class="face-auth-title">Xác Thực Khuôn Mặt</div>
                    <div class="face-auth-subtitle">Hệ thống sẽ hướng dẫn bạn định vị khuôn mặt</div>
                </div>
                <div class="face-auth-header-controls">
                    <button class="face-auth-voice-toggle" id="faceAuthVoiceToggle" title="Bật/Tắt giọng nói">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                            <line x1="12" y1="19" x2="12" y2="23"></line>
                            <line x1="8" y1="23" x2="16" y2="23"></line>
                        </svg>
                    </button>
                    <button class="face-auth-close-btn" id="faceAuthCloseBtn">×</button>
                </div>
            </div>
            <div class="face-auth-body">
                <div class="face-auth-loading-container" id="faceAuthLoadingModels">
                    <div class="face-auth-spinner"></div>
                    <h3>Đang tải hệ thống</h3>
                    <p>Xin đợi một lát...</p>
                </div>

                <div id="faceAuthCameraContent" class="face-auth-hidden">
                    <div class="face-auth-content">
                        <div class="face-auth-video-container">
                            <video class="face-auth-video" id="faceAuthVideo" autoplay playsinline></video>
                            <div class="face-auth-video-overlay">
                                <div class="face-auth-mask" id="faceAuthMask"></div>
                            </div>
                        </div>

                        <div class="face-auth-sidebar">
                            <div class="face-auth-instructions">
                                <ul>
                                    <li>Giữ khuôn mặt ở giữa khung hình</li>
                                    <li>Đảm bảo ánh sáng đầy đủ và rõ ràng</li>
                                    <li>Giữ nguyên tư thế khi hệ thống đang xác thực</li>
                                </ul>
                            </div>

                            <div class="face-auth-status-container">
                                <div class="face-auth-status-text" id="faceAuthStatusText">Đang khởi tạo camera...</div>
                                <div class="face-auth-progress-container">
                                    <div class="face-auth-progress-bar">
                                        <div class="face-auth-progress-fill" id="faceAuthProgressFill"></div>
                                    </div>
                                    <div class="face-auth-progress-text" id="faceAuthProgressText">0%</div>
                                </div>
                            </div>

                            <div class="face-auth-error-message" id="faceAuthErrorMessage"></div>
                            <div class="face-auth-success-message" id="faceAuthSuccessMessage"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const canvas = document.createElement('canvas');
        canvas.id = 'faceAuthCanvas';
        canvas.className = 'face-auth-hidden';

        document.body.appendChild(overlay);
        document.body.appendChild(popup);
        document.body.appendChild(canvas);

        // Inject styles
        this.injectStyles();
    }

    injectStyles() {
        // Xóa CSS cũ nếu tồn tại
        const oldStyles = document.getElementById('face-auth-styles');
        if (oldStyles) {
            oldStyles.remove();
        }
    
        const styles = `
            <style id="face-auth-styles">
                .face-auth-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: ${this.config.overlayColor};
                    backdrop-filter: blur(12px);
                    display: none;
                    z-index: 10000;
                    opacity: 0;
                    transition: opacity 0.4s ease;
                }
                .face-auth-overlay.show { opacity: 1; }
                .face-auth-popup {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) scale(0.9);
                    width: 95%;
                    max-width: 850px;
                    max-height: 90vh;
                    background: linear-gradient(145deg, ${this.config.backgroundColor}, #1a1a1a);
                    border-radius: 16px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
                    overflow: hidden;
                    z-index: 10001;
                    display: none;
                    opacity: 0;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .face-auth-popup.show {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 1;
                }
                .face-auth-header {
                    padding: 22px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(30, 30, 30, 0.8);
                }
                .face-auth-title {
                    font-size: 1.6rem;
                    font-weight: 700;
                    background: linear-gradient(90deg, ${this.config.primaryColor}, #5e9fff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    color: ${this.config.textColor};
                }
                .face-auth-subtitle {
                    font-size: 1rem;
                    color: ${this.config.subtitleColor};
                    margin-top: 6px;
                }
                .face-auth-header-controls {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }
                .face-auth-close-btn {
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    color: ${this.config.subtitleColor};
                    font-size: 1.5rem;
                    cursor: pointer;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }
                .face-auth-close-btn:hover {
                    background: rgba(255, 255, 255, 0.15);
                    color: ${this.config.textColor};
                    transform: rotate(90deg);
                }
                .face-auth-voice-toggle {
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    color: ${this.config.subtitleColor};
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .face-auth-voice-toggle:hover {
                    background: rgba(255, 255, 255, 0.15);
                    color: ${this.config.textColor};
                }
                .face-auth-voice-toggle.active {
                    color: ${this.config.primaryColor};
                    background: rgba(58, 134, 255, 0.2);
                }
                .face-auth-body {
                    padding: 22px;
                    overflow-y: auto;
                    max-height: calc(90vh - 130px);
                }
                .face-auth-content {
                    display: flex;
                    gap: 24px;
                    align-items: flex-start;
                }
                .face-auth-video-container {
                    position: relative;
                    width: 65%;
                    aspect-ratio: 4/5;
                    border-radius: 14px;
                    overflow: hidden;
                    background-color: #000;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
                    flex-shrink: 0;
                }
                .face-auth-video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transform: scaleX(-1);
                }
                .face-auth-video-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                }
                .face-auth-mask {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 75%;
                    height: 75%;
                    border: 3px solid ${this.config.primaryColor};
                    border-radius: 50%;
                    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 20px ${this.config.primaryColor}66;
                    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .face-auth-mask.good {
                    border-color: ${this.config.successColor};
                    box-shadow: 0 0 0 9999px ${this.config.successColor}1a, 0 0 30px ${this.config.successColor}80;
                    animation: face-auth-pulse 2s infinite;
                }
                .face-auth-mask.warning {
                    border-color: ${this.config.warningColor};
                    box-shadow: 0 0 0 9999px ${this.config.warningColor}1a, 0 0 20px ${this.config.warningColor}66;
                }
                .face-auth-mask.error {
                    border-color: ${this.config.errorColor};
                    box-shadow: 0 0 0 9999px ${this.config.errorColor}1a, 0 0 20px ${this.config.errorColor}66;
                }
                @keyframes face-auth-pulse {
                    0% { box-shadow: 0 0 0 9999px ${this.config.successColor}1a, 0 0 30px ${this.config.successColor}80; }
                    50% { box-shadow: 0 0 0 9999px ${this.config.successColor}26, 0 0 40px ${this.config.successColor}b3; }
                    100% { box-shadow: 0 0 0 9999px ${this.config.successColor}1a, 0 0 30px ${this.config.successColor}80; }
                }
                .face-auth-sidebar {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .face-auth-instructions {
                    text-align: left;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 18px;
                    border-radius: 14px;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .face-auth-instructions ul {
                    list-style-type: none;
                    padding-left: 0;
                }
                .face-auth-instructions li {
                    margin-bottom: 12px;
                    color: ${this.config.subtitleColor};
                    display: flex;
                    align-items: center;
                    transition: all 0.3s ease;
                }
                .face-auth-instructions li:hover {
                    color: ${this.config.textColor};
                    transform: translateX(5px);
                }
                .face-auth-instructions li:before {
                    content: "•";
                    color: ${this.config.primaryColor};
                    font-weight: bold;
                    margin-right: 12px;
                    font-size: 1.4rem;
                }
                .face-auth-status-container {
                    text-align: center;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 18px;
                    border-radius: 14px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .face-auth-status-text {
                    font-size: 1.1rem;
                    margin-bottom: 16px;
                    min-height: 26px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    color: ${this.config.textColor};
                }
                .face-auth-progress-container {
                    width: 100%;
                    margin-top: 12px;
                }
                .face-auth-progress-bar {
                    width: 100%;
                    height: 10px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 5px;
                    overflow: hidden;
                    position: relative;
                }
                .face-auth-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, ${this.config.primaryColor}, ${this.config.successColor});
                    border-radius: 5px;
                    width: 0%;
                    transition: width 0.5s ease;
                    position: relative;
                    overflow: hidden;
                }
                .face-auth-progress-fill::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
                    animation: face-auth-shine 2s infinite;
                }
                @keyframes face-auth-shine {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
                .face-auth-progress-text {
                    text-align: center;
                    margin-top: 10px;
                    font-size: 1rem;
                    color: ${this.config.subtitleColor};
                    font-weight: 500;
                }
                .face-auth-error-message {
                    color: ${this.config.errorColor};
                    margin-top: 16px;
                    padding: 14px;
                    background: ${this.config.errorColor}1a;
                    border-radius: 12px;
                    display: none;
                    border-left: 4px solid ${this.config.errorColor};
                }
                .face-auth-success-message {
                    color: ${this.config.successColor};
                    margin-top: 16px;
                    padding: 14px;
                    background: ${this.config.successColor}1a;
                    border-radius: 12px;
                    display: none;
                    border-left: 4px solid ${this.config.successColor};
                }
                .face-auth-loading-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 50px 20px;
                    text-align: center;
                }
                .face-auth-loading-container h3 {
                    color: ${this.config.textColor};
                    margin-bottom: 10px;
                    font-size: 1.3rem;
                    font-weight: 600;
                }
                .face-auth-loading-container p {
                    color: ${this.config.textColor};
                    font-size: 1rem;
                    margin: 0;
                }
                .face-auth-spinner {
                    width: 60px;
                    height: 60px;
                    border: 4px solid ${this.config.primaryColor}4d;
                    border-radius: 50%;
                    border-top-color: ${this.config.primaryColor};
                    animation: face-auth-spin 1s linear infinite;
                    margin-bottom: 24px;
                }
                @keyframes face-auth-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .face-auth-hidden {
                    display: none;
                }
                .face-auth-fade-in {
                    animation: face-auth-fadeIn 0.5s ease forwards;
                }
                @keyframes face-auth-fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (max-width: 900px) {
                    .face-auth-popup { width: 98%; max-height: 95vh; }
                    .face-auth-body { max-height: calc(95vh - 130px); padding: 18px; }
                    .face-auth-header { padding: 18px; }
                    .face-auth-content { flex-direction: column; }
                    .face-auth-video-container { width: 100%; }
                }
            </style>
        `;
    
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    cacheDOMElements() {
        this.overlay = document.getElementById('faceAuthOverlay');
        this.popup = document.getElementById('faceAuthPopup');
        this.closeBtn = document.getElementById('faceAuthCloseBtn');
        this.video = document.getElementById('faceAuthVideo');
        this.statusText = document.getElementById('faceAuthStatusText');
        this.progressText = document.getElementById('faceAuthProgressText');
        this.progressFill = document.getElementById('faceAuthProgressFill');
        this.errorMessage = document.getElementById('faceAuthErrorMessage');
        this.successMessage = document.getElementById('faceAuthSuccessMessage');
        this.canvas = document.getElementById('faceAuthCanvas');
        this.loadingModels = document.getElementById('faceAuthLoadingModels');
        this.cameraContent = document.getElementById('faceAuthCameraContent');
        this.faceMask = document.getElementById('faceAuthMask');
        this.voiceToggle = document.getElementById('faceAuthVoiceToggle');
    }

    initEventListeners() {
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.close(); // Gọi close() trực tiếp
            });
        }
        if (this.voiceToggle) {
            this.voiceToggle.addEventListener('click', () => this.toggleVoice());
        }
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close(); // Gọi close() trực tiếp khi click overlay
                }
            });
        }
    }

    initVoice() {
        // Nếu browser không hỗ trợ thì tắt luôn
        if (!('speechSynthesis' in window)) {
            console.warn('Speech synthesis not supported');
            this.voiceEnabled = false;
            if (this.voiceToggle) {
                this.voiceToggle.style.display = 'none';
            }
            return;
        }
    
        // Gọi trước 1 lần để "wake up" voice list (trick cho Chrome)
        try {
            window.speechSynthesis.getVoices();
        } catch (e) {
            console.warn('Cannot pre-load voices:', e);
        }
    
        const pickVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            if (!voices || !voices.length) return;
    
            // Ưu tiên tiếng Việt
            this.viVoice =
                voices.find(v => v.lang.toLowerCase().startsWith('vi')) ||
                voices.find(v => v.lang.toLowerCase().startsWith('en')) ||
                voices[0];
    
            console.log('Selected voice:', this.viVoice && this.viVoice.name);
        };
    
        pickVoice();
        window.speechSynthesis.onvoiceschanged = pickVoice;
    }
    
    async open() {
        // Reset state
        this.resetProgress();
        this.hideMessages();
        this.foreignObjectDetected = false;
        this.resetFaceValidation();
        this.isSpeaking = false;
        
        // Show popup with animation
        this.overlay.style.display = 'block';
        this.popup.style.display = 'block';
        
        setTimeout(() => {
            this.overlay.classList.add('show');
            this.popup.classList.add('show');
        }, 10);
        
        // Show loading
        this.loadingModels.classList.remove('face-auth-hidden');
        this.cameraContent.classList.add('face-auth-hidden');
        
        // ẨN NÚT CLOSE KHI ĐANG LOAD
        if (this.closeBtn) {
            this.closeBtn.style.display = 'none';
        }
        
        try {
            await this.initialize();
            
            // Show camera content
            this.loadingModels.classList.add('face-auth-hidden');
            this.cameraContent.classList.remove('face-auth-hidden');
            this.cameraContent.classList.add('face-auth-fade-in');
            
            // HIỆN LẠI NÚT CLOSE KHI LOAD XONG
            if (this.closeBtn) {
                this.closeBtn.style.display = 'flex';
            }
            
            // Voice guidance
            if (this.voiceEnabled) {
                this.speak("Xin chào! Hãy đưa khuôn mặt của bạn vào khung hình");
            }
        } catch (error) {
            console.error('Error initializing camera:', error);
            
            // HIỆN LẠI NÚT CLOSE KHI CÓ LỖI
            if (this.closeBtn) {
                this.closeBtn.style.display = 'flex';
            }
            
            this.showError('Không thể khởi tạo camera. Vui lòng thử lại.');
            
            if (this.config.onError) {
                this.config.onError(error);
            }
        }
    }

    close() {
        console.log('Closing FaceAuth...');
                
        // 1. Dừng speech synthesis đầu tiên
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            console.log('Speech synthesis cancelled');
        }
        
        this.isSpeaking = false;
        
        // 2. Dừng camera stream
        if (this.stream) {
            console.log('Stopping camera stream...');
            this.stream.getTracks().forEach(track => {
                console.log('Stopping track:', track.kind);
                track.stop();
            });
            this.stream = null;
        }
        
        // 3. Clear video source
        if (this.video) {
            this.video.srcObject = null;
        }
        
        // 4. Clear intervals và animation frames
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // 5. Dispose TensorFlow.js model và memory
        if (this.faceDetectionModel) {
            console.log('Cleaning up face detection model...');
            try {
                // Đối với face-landmarks-detection, dispose model
                if (typeof this.faceDetectionModel.dispose === 'function') {
                    this.faceDetectionModel.dispose();
                }
                
                // Clean up TensorFlow.js memory
                if (typeof tf !== 'undefined') {
                    tf.disposeVariables();
                }
                
            } catch (error) {
                console.warn('Model cleanup warning:', error.message);
            }
            this.faceDetectionModel = null;
        }
        
        // 6. Ẩn popup với animation
        this.overlay.classList.remove('show');
        this.popup.classList.remove('show');
        
        setTimeout(() => {
            this.popup.style.display = 'none';
            this.overlay.style.display = 'none';
            
            // 7. Remove DOM elements sau khi animation
            this.removeDOM();
        }, 400);
        
        // 8. Reset state
        this.resetProgress();
        this.hideMessages();
        this.isCapturing = false;
        this.isCentered = false;
        this.foreignObjectDetected = false;
        this.resetFaceValidation();
        
        // 9. Call onClose callback
        if (this.config.onClose) {
            this.config.onClose();
        }
        
        console.log('FaceAuth closed completely');
    }

    removeDOM() {
        // Danh sách tất cả các elements cần xóa
        const elementsToRemove = [
            'faceAuthOverlay',
            'faceAuthPopup', 
            'faceAuthCanvas',
            'face-auth-styles'
        ];
        
        // Xóa từng element
        elementsToRemove.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.parentNode) {
                element.remove();
            }
        });
        
        // Reset tất cả cached DOM elements về null
        this.overlay = null;
        this.popup = null;
        this.canvas = null;
        this.video = null;
        this.closeBtn = null;
        this.voiceToggle = null;
        this.statusText = null;
        this.progressText = null;
        this.progressFill = null;
        this.errorMessage = null;
        this.successMessage = null;
        this.loadingModels = null;
        this.cameraContent = null;
        this.faceMask = null;
        
        console.log('DOM elements removed completely');
    }

    async initialize() {
        // Load face detection model
        await this.loadFaceDetectionModel();
        
        // Request camera access
        await this.requestCameraAccess();
        
        // Start face detection
        this.startFaceDetection();
    }

    async loadFaceDetectionModel() {
        try {
            this.setStatus('Đang tải hệ thống...');
            
            // Speak loading message
            if (this.voiceEnabled) {
                this.speak("Đang tải hệ thống, xin đợi một lát");
            }
            
            // Load TensorFlow.js model for face detection
            this.faceDetectionModel = await faceLandmarksDetection.load(
                faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
                { 
                    maxFaces: 1,
                    shouldLoadIrisModel: false 
                }
            );
            
            console.log('Face detection model loaded successfully');
            
        } catch (error) {
            console.error('Failed to load face detection model:', error);
            throw new Error('Không thể tải mô hình nhận diện khuôn mặt.');
        }
    }

    async requestCameraAccess() {
        try {
            this.setStatus('Đang kết nối camera...');
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "user",
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } 
            });
            this.video.srcObject = this.stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    resolve();
                };
            });
            
            this.setStatus('Đang tìm khuôn mặt...');
        } catch (error) {
            let errorMsg = 'Không thể truy cập camera. ';
            
            if (error.name === 'NotAllowedError') {
                errorMsg += 'Vui lòng cấp quyền truy cập camera.';
            } else if (error.name === 'NotFoundError') {
                errorMsg += 'Không tìm thấy camera.';
            } else {
                errorMsg += 'Vui lòng kiểm tra quyền trình duyệt.';
            }
            
            throw new Error(errorMsg);
        }
    }

    startFaceDetection() {
        let lastDetectionTime = 0;
        
        const detectFaces = async () => {
            if (!this.stream || this.isCapturing) {
                this.animationFrameId = requestAnimationFrame(detectFaces);
                return;
            }
            
            const now = Date.now();
            if (now - lastDetectionTime < this.config.detectionInterval) {
                this.animationFrameId = requestAnimationFrame(detectFaces);
                return;
            }
            
            lastDetectionTime = now;
            
            try {
                const faces = await this.faceDetectionModel.estimateFaces({
                    input: this.video,
                    returnTensors: false,
                    flipHorizontal: false,
                    predictIrises: false
                });

                if (faces.length > 0) {
                    const face = faces[0];
                    const faceValidation = this.validateFace(face);
                    const isFaceCentered = this.checkFacePosition(face);
                    
                    // Check for foreign objects (multiple faces)
                    if (faces.length > 1) {
                        this.foreignObjectDetected = true;
                        this.showError("Phát hiện nhiều khuôn mặt hoặc vật thể lạ. Vui lòng chỉ để một khuôn mặt trong khung hình.");
                        this.resetProgress();
                        if (this.voiceEnabled && !this.isSpeaking) {
                            this.speak("Phát hiện vật thể lạ. Vui lòng chỉ để khuôn mặt trong khung hình.");
                        }
                    } else {
                        this.foreignObjectDetected = false;
                        this.hideMessages();
                        
                        // Check for covered face (hand over face)
                        const isFaceCovered = this.checkFaceCovered(face);
                        if (isFaceCovered) {
                            this.showError("Khuôn mặt bị che. Vui lòng để lộ toàn bộ khuôn mặt.");
                            this.resetProgress();
                            if (this.voiceEnabled && !this.isSpeaking) {
                                this.speak("Khuôn mặt bị che. Vui lòng để lộ toàn bộ khuôn mặt.");
                            }
                            return;
                        }
                        
                        // Check if face is valid
                        if (!faceValidation.isFullFace) {
                            let errorMsg = "Không nhận diện được đầy đủ khuôn mặt. ";
                            
                            if (!faceValidation.hasBothEyes) {
                                errorMsg += "Vui lòng để lộ cả hai mắt. ";
                            }
                            if (!faceValidation.hasNose) {
                                errorMsg += "Vui lòng để lộ mũi. ";
                            }
                            if (!faceValidation.hasMouth) {
                                errorMsg += "Vui lòng để lộ miệng. ";
                            }
                            
                            this.showError(errorMsg);
                            this.resetProgress();
                            
                            if (this.voiceEnabled && !this.isSpeaking) {
                                this.speak("Vui lòng để lộ toàn bộ khuôn mặt bao gồm mắt, mũi và miệng");
                            }
                        } else {
                            this.onFaceDetectionResult(isFaceCentered);
                        }
                    }
                } else {
                    this.foreignObjectDetected = false;
                    this.resetFaceValidation();
                    this.hideMessages();
                    this.onFaceDetectionResult(false);
                }
            } catch (error) {
                console.error('Face detection error:', error);
            }
            
            this.animationFrameId = requestAnimationFrame(detectFaces);
        };
        
        this.animationFrameId = requestAnimationFrame(detectFaces);
    }

    checkFaceCovered(face) {
        const landmarks = face.keypoints || face.scaledMesh || [];
        
        const leftEyeIndices = [33, 133, 160, 159, 158, 144, 145, 153];
        const rightEyeIndices = [362, 263, 387, 386, 385, 373, 374, 380];
        const noseIndices = [1, 2, 98, 327];
        const mouthIndices = [13, 14, 78, 308, 78, 95, 88, 178];
        
        const leftEyeCount = leftEyeIndices.filter(index => landmarks[index]).length;
        const rightEyeCount = rightEyeIndices.filter(index => landmarks[index]).length;
        const noseCount = noseIndices.filter(index => landmarks[index]).length;
        const mouthCount = mouthIndices.filter(index => landmarks[index]).length;
        
        if (leftEyeCount < 3 || rightEyeCount < 3 || noseCount < 2 || mouthCount < 3) {
            return true;
        }
        
        const boundingBox = face.boundingBox;
        if (boundingBox) {
            const faceWidth = boundingBox.bottomRight[0] - boundingBox.topLeft[0];
            const faceHeight = boundingBox.bottomRight[1] - boundingBox.topLeft[1];
            
            if (faceWidth < 100 || faceHeight < 100 || faceWidth/faceHeight < 0.5 || faceWidth/faceHeight > 2) {
                return true;
            }
        }
        
        return false;
    }

    validateFace(face) {
        this.resetFaceValidation();
        
        const landmarks = face.keypoints || face.scaledMesh || [];
        
        const leftEyeIndices = [33, 133, 160, 159, 158, 144, 145, 153];
        const rightEyeIndices = [362, 263, 387, 386, 385, 373, 374, 380];
        const noseIndices = [1, 2, 98, 327];
        const mouthIndices = [13, 14, 78, 308, 78, 95, 88, 178];
        
        this.faceValidationChecks.hasBothEyes = (
            leftEyeIndices.some(index => landmarks[index]) && 
            rightEyeIndices.some(index => landmarks[index])
        );
        
        this.faceValidationChecks.hasNose = noseIndices.some(index => landmarks[index]);
        this.faceValidationChecks.hasMouth = mouthIndices.some(index => landmarks[index]);
        
        this.faceValidationChecks.isFullFace = (
            this.faceValidationChecks.hasBothEyes && 
            this.faceValidationChecks.hasNose && 
            this.faceValidationChecks.hasMouth
        );
        
        return this.faceValidationChecks;
    }

    resetFaceValidation() {
        this.faceValidationChecks = {
            hasBothEyes: false,
            hasNose: false,
            hasMouth: false,
            isFullFace: false
        };
    }

    checkFacePosition(face) {
        const boundingBox = face.boundingBox;
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        
        const faceCenterX = (boundingBox.topLeft[0] + boundingBox.bottomRight[0]) / 2;
        const faceCenterY = (boundingBox.topLeft[1] + boundingBox.bottomRight[1]) / 2;
        
        const videoCenterX = videoWidth / 2;
        const videoCenterY = videoHeight / 2;
        
        const distanceX = Math.abs(faceCenterX - videoCenterX);
        const distanceY = Math.abs(faceCenterY - videoCenterY);
        
        const faceWidth = boundingBox.bottomRight[0] - boundingBox.topLeft[0];
        const faceHeight = boundingBox.bottomRight[1] - boundingBox.topLeft[1];
        const faceSize = Math.max(faceWidth, faceHeight);
        const minSize = Math.min(videoWidth, videoHeight) * this.config.minFaceSize;
        const maxSize = Math.min(videoWidth, videoHeight) * this.config.maxFaceSize;
        
        const isCentered = distanceX < videoWidth * this.config.centerThreshold && 
                          distanceY < videoHeight * this.config.centerThreshold &&
                          faceSize > minSize && 
                          faceSize < maxSize;
        
        let statusMessage = '';
        let voiceMessage = '';
        
        if (this.foreignObjectDetected) {
            this.faceMask.className = 'face-auth-mask error';
            statusMessage = 'Vui lòng chỉ để khuôn mặt trong khung hình';
        } else if (!this.faceValidationChecks.isFullFace) {
            this.faceMask.className = 'face-auth-mask error';
            statusMessage = 'Vui lòng để lộ toàn bộ khuôn mặt';
        } else if (isCentered && faceSize > minSize && faceSize < maxSize) {
            this.faceMask.className = 'face-auth-mask good';
            statusMessage = 'Khuôn mặt đã ở vị trí tốt. Giữ nguyên...';
        } else if (distanceX < videoWidth * this.config.warningThreshold && 
                  distanceY < videoHeight * this.config.warningThreshold) {
            this.faceMask.className = 'face-auth-mask warning';
            
            if (faceSize < minSize) {
                statusMessage = 'Hãy tiến lại gần hơn.';
                voiceMessage = 'Hãy tiến lại gần hơn một chút';
            } else if (faceSize > maxSize) {
                statusMessage = 'Hãy lùi ra xa hơn.';
                voiceMessage = 'Hãy lùi ra xa hơn một chút';
            } else {
                statusMessage = 'Hãy di chuyển khuôn mặt vào giữa khung.';
                voiceMessage = 'Hãy di chuyển khuôn mặt vào giữa khung hình';
            }
        } else {
            this.faceMask.className = 'face-auth-mask error';
            statusMessage = 'Đưa khuôn mặt vào khung hình.';
            voiceMessage = 'Xin hãy đưa khuôn mặt vào trong khung hình';
        }
        
        if (statusMessage !== this.lastStatus) {
            this.setStatus(statusMessage);
            this.lastStatus = statusMessage;
            
            if (this.voiceEnabled && voiceMessage && voiceMessage !== this.lastVoiceMessage && 
                !this.isSpeaking && !this.foreignObjectDetected) {
                this.speak(voiceMessage);
                this.lastVoiceMessage = voiceMessage;
            }
        }
        
        return isCentered && faceSize > minSize && faceSize < maxSize && 
               !this.foreignObjectDetected && this.faceValidationChecks.isFullFace;
    }

    setStatus(message) {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }

    resetProgress() {
        this.progress = 0;
        this.updateProgressUI();
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    updateProgressUI() {
        if (this.progressText) {
            this.progressText.textContent = `${this.progress}%`;
        }
        if (this.progressFill) {
            this.progressFill.style.width = `${this.progress}%`;
        }
    }

    hideMessages() {
        if (this.errorMessage) this.errorMessage.style.display = 'none';
        if (this.successMessage) this.successMessage.style.display = 'none';
    }

    showError(message) {
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
            this.errorMessage.style.display = 'block';
        }
        if (this.successMessage) {
            this.successMessage.style.display = 'none';
        }
        
        if (this.voiceEnabled && !this.isSpeaking) {
            this.speak(message);
        }
    }

    showSuccess(message) {
        if (this.successMessage) {
            this.successMessage.textContent = message;
            this.successMessage.style.display = 'block';
        }
        if (this.errorMessage) {
            this.errorMessage.style.display = 'none';
        }
    }

    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
    
        if (this.voiceToggle) {
            this.voiceToggle.classList.toggle('active', this.voiceEnabled);
        }
    
        if (!this.voiceEnabled) {
            // Tắt là dừng toàn bộ queue
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            this.isSpeaking = false;
        } else {
            // Bật lại thì nói 1 câu báo
            this.speak("Đã bật hướng dẫn bằng giọng nói");
        }
    }
    

    speak(text) {
        // Nếu đang tắt tiếng thì thôi
        if (!this.voiceEnabled) return;
        if (!('speechSynthesis' in window)) return;
    
        // Hủy mọi câu đang queue để tránh bị kẹt, sau đó nói câu mới
        try {
            window.speechSynthesis.cancel();
        } catch (e) {
            console.warn('Cancel speech error:', e);
        }
    
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;
    
        // Nếu lúc init đã chọn được voice tiếng Việt thì dùng
        if (this.viVoice) {
            utterance.voice = this.viVoice;
            utterance.lang = this.viVoice.lang;
        } else {
            // Fallback: cố tìm lại 1 lần
            const voices = window.speechSynthesis.getVoices();
            const viVoice = voices.find(v =>
                v.lang.toLowerCase().includes('vi') ||
                v.name.toLowerCase().includes('vietnam')
            );
            if (viVoice) {
                utterance.voice = viVoice;
                utterance.lang = viVoice.lang;
            }
        }
    
        this.isSpeaking = true;
    
        utterance.onend = () => {
            this.isSpeaking = false;
            console.log('Speech finished:', text);
        };
    
        utterance.onerror = (e) => {
            this.isSpeaking = false;
            console.error('Speech error:', e);
        };
    
        console.log('Speaking:', text);
        window.speechSynthesis.speak(utterance);
    }
    

    onFaceDetectionResult(centered) {
        if (this.isCapturing || this.foreignObjectDetected || !this.faceValidationChecks.isFullFace) return;
        
        if (centered && !this.isCentered) {
            this.isCentered = true;
            
            if (!this.progressInterval) {
                this.progressInterval = setInterval(() => this.increaseProgress(), this.config.progressIntervalTime);
            }
            
            if (this.voiceEnabled && !this.isSpeaking) {
                this.speak("Tốt lắm! Giữ nguyên tư thế");
            }
        } else if (!centered && this.isCentered) {
            this.isCentered = false;
            this.resetProgress();
        }
    }

    increaseProgress() {
        if (!this.isCentered) {
            this.resetProgress();
            return;
        }

        if (this.progress < 100) {
            this.progress += this.config.progressStep;
            this.updateProgressUI();
            
            if (this.progress === 30) {
                this.setStatus('Đang xác thực...');
                if (this.voiceEnabled && !this.isSpeaking) {
                    this.speak("Đang xác thực khuôn mặt");
                }
            } else if (this.progress === 60) {
                this.setStatus('Sắp xong rồi...');
                if (this.voiceEnabled && !this.isSpeaking) {
                    this.speak("Sắp xong rồi, cố gắng giữ nguyên tư thế");
                }
            } else if (this.progress === 85) {
                this.setStatus('Cố đừng rời camera...');
                if (this.voiceEnabled && !this.isSpeaking) {
                    this.speak("Cố gắng đừng rời camera");
                }
            }
        } else {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
            this.setStatus('Tuyệt quá!');
            if (this.voiceEnabled && !this.isSpeaking) {
                this.speak("Tuyệt quá! Xác thực thành công. Cảm ơn quý khách");
            }
            this.captureImage();
        }
    }

    captureImage() {
        this.isCapturing = true;
        this.setStatus('Đang chụp ảnh...');
        
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        this.canvas.width = videoWidth;
        this.canvas.height = videoHeight;
        
        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0, videoWidth, videoHeight);
        
        this.canvas.toBlob((blob) => {
            this.uploadImage(blob);
        }, 'image/jpeg', 0.9);
    }

    uploadImage(blob) {
        this.setStatus('Đang gửi dữ liệu...');
        
        if (this.voiceEnabled && !this.isSpeaking) {
            this.speak("Đang gửi dữ liệu xác thực");
        }
        
        if (this.config.onCapture) {
            this.config.onCapture(blob);
        }
        
        setTimeout(() => {
            this.showSuccess('Xác thực thành công!');
            this.setStatus('Hoàn tất!');
            
            setTimeout(() => {
                this.close();
            }, 2000);
        }, 1500);
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    isOpen() {
        return this.popup && this.popup.style.display !== 'none';
    }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FaceAuth;
} else if (typeof define === 'function' && define.amd) {
    define([], function() { return FaceAuth; });
} else {
    window.FaceAuth = FaceAuth;
}