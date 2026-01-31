// VideoSaver Pro - Premium JavaScript

// Header Scroll Effect
window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Mobile Menu Toggle
function toggleMobileMenu() {
    const mobileNav = document.getElementById('mobileNav');
    const mobileOverlay = document.getElementById('mobileOverlay');
    mobileNav.classList.toggle('active');
    mobileOverlay.classList.toggle('active');
}

// FAQ Toggle
function toggleFAQ(button) {
    const item = button.parentElement;
    const answer = item.querySelector('.faq-answer');
    const isActive = item.classList.contains('active');

    // Close all FAQs
    document.querySelectorAll('.faq-item').forEach(faq => {
        faq.classList.remove('active');
        faq.querySelector('.faq-answer').style.maxHeight = null;
    });

    // Open clicked FAQ if it wasn't active
    if (!isActive) {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
    }
}

// Smooth Scroll to sections
function scrollToDownload() {
    document.getElementById('download').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Smooth scroll for all anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Download Functionality
async function handleDownload(e) {
    e.preventDefault();

    const url = document.getElementById('videoUrl').value.trim();
    const downloadBtn = document.getElementById('downloadBtn');
    const btnText = document.getElementById('btnText');
    const btnIcon = document.getElementById('btnIcon');
    const resultBox = document.getElementById('resultBox');

    if (!url) {
        showNotification('Please enter a video URL', 'error');
        return;
    }

    // Validate URL
    try {
        new URL(url);
    } catch {
        showNotification('Please enter a valid URL', 'error');
        return;
    }

    // Set loading state
    downloadBtn.disabled = true;
    btnText.textContent = 'Processing...';
    btnIcon.innerHTML = '<div class="spinner"></div>';
    resultBox.innerHTML = '';

    try {
        // Call API
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            throw new Error('Download failed');
        }

        const data = await response.json();

        // Parse response
        let videoUrl = null;
        let title = 'Video Ready';

        if (data.medias && data.medias.length > 0) {
            const bestQuality = data.medias.find(m => !m.watermark && m.extension === 'mp4') || data.medias[0];
            videoUrl = bestQuality.url;
        }

        if (data.title) {
            title = data.title;
        }

        if (!videoUrl) {
            throw new Error('No video found');
        }

        // Show result
        const sanitizedTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

        resultBox.innerHTML = `
            <div class="result-box">
                <h3>
                    <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/>
                    </svg>
                    ${sanitizedTitle}
                </h3>
                <p style="color: var(--text-light); margin-bottom: 1rem;">Your video is ready to download in HD quality</p>
                <button class="download-result-btn" onclick="window.open('${videoUrl}', '_blank')">
                    <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="display: inline; margin-right: 8px;">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    Download HD Video
                </button>
            </div>
        `;

        showNotification('Video ready to download!', 'success');

    } catch (error) {
        console.error('Error:', error);
        showNotification('Failed to download. Please check the URL and try again.', 'error');
    } finally {
        // Reset button
        downloadBtn.disabled = false;
        btnText.textContent = 'Download';
        btnIcon.innerHTML = '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>';
    }
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--primary)'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Intersection Observer for Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements on DOM load
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.feature-card, .faq-item, .blog-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease-out';
        observer.observe(el);
    });
});

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        const videoInput = document.getElementById('videoUrl');
        if (videoInput) {
            e.preventDefault();
            videoInput.focus();
        }
    }

    // Escape to close mobile menu
    if (e.key === 'Escape') {
        const mobileNav = document.getElementById('mobileNav');
        if (mobileNav.classList.contains('active')) {
            toggleMobileMenu();
        }
    }
});

// Performance: Lazy load images
if ('loading' in HTMLImageElement.prototype) {
    const images = document.querySelectorAll('img[loading="lazy"]');
    images.forEach(img => {
        if (img.dataset.src) {
            img.src = img.dataset.src;
        }
    });
}
