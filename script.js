// VideoSaver Pro - site scripts

function qs(id) {
    return document.getElementById(id);
}

// Header scroll state
window.addEventListener('scroll', () => {
    const header = qs('header');
    if (!header) return;
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

function toggleMobileMenu() {
    const mobileNav = qs('mobileNav');
    const mobileOverlay = qs('mobileOverlay');
    if (!mobileNav || !mobileOverlay) return;
    mobileNav.classList.toggle('active');
    mobileOverlay.classList.toggle('active');
}

function toggleFAQ(button) {
    const item = button?.parentElement;
    if (!item) return;
    const answer = item.querySelector('.faq-answer');
    const isActive = item.classList.contains('active');

    document.querySelectorAll('.faq-item').forEach((faq) => {
        faq.classList.remove('active');
        const faqAnswer = faq.querySelector('.faq-answer');
        if (faqAnswer) faqAnswer.style.maxHeight = null;
    });

    if (!isActive && answer) {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
    }
}

function scrollToDownload() {
    const section = qs('download');
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function onAnchorClick(e) {
        const href = this.getAttribute('href');
        if (!href || href === '#') return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.25rem;
        background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--primary)'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: 600;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2500);
}

async function handleDownload(e) {
    e.preventDefault();

    const input = qs('videoUrl');
    const downloadBtn = qs('downloadBtn');
    const btnText = qs('btnText');
    const btnIcon = qs('btnIcon');
    const resultBox = qs('resultBox');

    if (!input || !downloadBtn || !btnText || !btnIcon || !resultBox) return;

    const url = input.value.trim();
    if (!url) {
        showNotification('Please enter a video URL', 'error');
        return;
    }

    try {
        new URL(url);
    } catch {
        showNotification('Please enter a valid URL', 'error');
        return;
    }

    downloadBtn.disabled = true;
    btnText.textContent = 'Processing...';
    btnIcon.innerHTML = '<div class="spinner"></div>';
    resultBox.innerHTML = '';

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            throw new Error('Request failed');
        }

        const data = await response.json();
        const media = data?.medias?.find((m) => !m.watermark && m.extension === 'mp4') || data?.medias?.[0];
        const videoUrl = media?.url;
        const title = data?.title || 'Video Ready';

        if (!videoUrl) {
            throw new Error('No video found');
        }

        const safeTitle = title
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        resultBox.innerHTML = `
            <div class="result-box">
                <h3>${safeTitle}</h3>
                <p style="color: var(--text-light); margin-bottom: 1rem;">Your video is ready to download</p>
                <button class="download-result-btn" onclick="window.open('${videoUrl}', '_blank')">Download HD Video</button>
            </div>
        `;
        showNotification('Video ready to download', 'success');
    } catch (error) {
        console.error(error);
        showNotification('Failed to download. Try another URL.', 'error');
    } finally {
        downloadBtn.disabled = false;
        btnText.textContent = 'Download';
        btnIcon.innerHTML = '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>';
    }
}

// Simple on-scroll reveal
const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        });
    },
    { threshold: 0.1, rootMargin: '0px 0px -80px 0px' }
);

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.feature-card, .faq-item, .blog-card').forEach((el) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px)';
        el.style.transition = 'all .5s ease-out';
        observer.observe(el);
    });
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        const input = qs('videoUrl');
        if (!input) return;
        e.preventDefault();
        input.focus();
    }
    if (e.key === 'Escape') {
        const mobileNav = qs('mobileNav');
        if (mobileNav?.classList.contains('active')) {
            toggleMobileMenu();
        }
    }
});
