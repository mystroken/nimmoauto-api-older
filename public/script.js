// Global variables
let statusCheckInterval;
let qrCheckInterval;
const API_BASE_URL = window.location.origin + '/api';

// DOM elements
const qrLoading = document.getElementById('qrLoading');
const qrCode = document.getElementById('qrCode');
const qrImage = document.getElementById('qrImage');
const qrSuccess = document.getElementById('qrSuccess');
const qrError = document.getElementById('qrError');
const errorMessage = document.getElementById('errorMessage');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const lastUpdate = document.getElementById('lastUpdate');

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    loadQRCode();
    startStatusMonitoring();
});

// Load QR code from the server
async function loadQRCode() {
    try {
        showLoading();
        updateStatus('Connecting...', 'connecting');
        
        const response = await fetch(`${API_BASE_URL}/whatsapp/qr`);
        const data = await response.json();
        
        if (data.success) {
            if (data.data.isAuthenticated) {
                showSuccess();
                updateStatus('Connected', 'connected');
            } else if (data.data.qrCode) {
                showQRCode(data.data.qrCode);
                updateStatus('QR Code Ready', 'ready');
                startQRMonitoring();
            } else {
                showError('QR code not available yet. Please wait...');
                updateStatus('Waiting for QR', 'waiting');
                // Retry after 3 seconds
                setTimeout(loadQRCode, 3000);
            }
        } else {
            showError(data.message || 'Failed to load QR code');
            updateStatus('Error', 'error');
        }
    } catch (error) {
        console.error('Error loading QR code:', error);
        showError('Network error. Please check your connection.');
        updateStatus('Error', 'error');
    }
}

// Start monitoring QR code status
function startQRMonitoring() {
    if (qrCheckInterval) {
        clearInterval(qrCheckInterval);
    }
    
    qrCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/whatsapp/status`);
            const data = await response.json();
            
            if (data.success && data.data.isReady) {
                showSuccess();
                updateStatus('Connected', 'connected');
                clearInterval(qrCheckInterval);
            }
        } catch (error) {
            console.error('Error checking status:', error);
        }
    }, 2000); // Check every 2 seconds
}

// Start status monitoring
function startStatusMonitoring() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/whatsapp/status`);
            const data = await response.json();
            
            if (data.success) {
                if (data.data.isReady) {
                    updateStatus('Connected', 'connected');
                    showSuccess();
                } else {
                    updateStatus('Disconnected', 'disconnected');
                }
            }
        } catch (error) {
            console.error('Error monitoring status:', error);
            updateStatus('Connection Error', 'error');
        }
    }, 5000); // Check every 5 seconds
}

// Show loading state
function showLoading() {
    qrLoading.style.display = 'flex';
    qrCode.style.display = 'none';
    qrSuccess.style.display = 'none';
    qrError.style.display = 'none';
}

// Show QR code
function showQRCode(qrCodeDataUrl) {
    qrLoading.style.display = 'none';
    qrCode.style.display = 'block';
    qrSuccess.style.display = 'none';
    qrError.style.display = 'none';
    
    qrImage.src = qrCodeDataUrl;
    qrImage.onload = () => {
        // Add a subtle animation when QR code loads
        qrImage.style.opacity = '0';
        qrImage.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            qrImage.style.transition = 'all 0.3s ease';
            qrImage.style.opacity = '1';
            qrImage.style.transform = 'scale(1)';
        }, 100);
    };
}

// Show success state
function showSuccess() {
    qrLoading.style.display = 'none';
    qrCode.style.display = 'none';
    qrSuccess.style.display = 'flex';
    qrError.style.display = 'none';
    
    // Stop monitoring
    if (qrCheckInterval) {
        clearInterval(qrCheckInterval);
    }
}

// Show error state
function showError(message) {
    qrLoading.style.display = 'none';
    qrCode.style.display = 'none';
    qrSuccess.style.display = 'none';
    qrError.style.display = 'flex';
    
    errorMessage.textContent = message;
}

// Update status display
function updateStatus(text, state) {
    statusText.textContent = text;
    lastUpdate.textContent = getTimeString();
    
    // Update status icon
    statusIcon.className = 'fas fa-circle';
    
    switch (state) {
        case 'connected':
            statusIcon.classList.add('connected');
            break;
        case 'error':
            statusIcon.classList.add('error');
            break;
        case 'waiting':
            statusIcon.classList.add('waiting');
            break;
        default:
            // Default yellow for connecting/ready
            break;
    }
}

// Get formatted time string
function getTimeString() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Add some interactive effects
document.addEventListener('DOMContentLoaded', function() {
    // Add click effect to retry button
    const retryBtn = document.querySelector('.retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', function(e) {
            // Add ripple effect
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'r' || e.key === 'R') {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                loadQRCode();
            }
        }
    });
});

// Add CSS for ripple effect
const style = document.createElement('style');
style.textContent = `
    .retry-btn {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
