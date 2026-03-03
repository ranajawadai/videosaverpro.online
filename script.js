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

function formatDuration(seconds) {
    if (!seconds || Number.isNaN(Number(seconds))) return '';
    const s = Number(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

async function triggerFileDownload(url, filename = 'videosaverpro-download.mp4') {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) throw new Error('Download request failed');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
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
        const apiBase = window.VSP_API_BASE || 'https://api.videosaverpro.online';
        let videoUrl;
        let title;

        const inspectRes = await fetch(`${apiBase}/v1/link/inspect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!inspectRes.ok) throw new Error('Inspect failed');
        const preview = await inspectRes.json();

        const createRes = await fetch(`${apiBase}/v1/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, quality: '1080p', format: 'mp4' })
        });
        if (!createRes.ok) throw new Error('Job creation failed');
        const created = await createRes.json();
        const jobId = created?.job_id;
        if (!jobId) throw new Error('Job id missing');

        let attempts = 0;
        let statusData = null;
        while (attempts < 20) {
            await new Promise((r) => setTimeout(r, 1200));
            const statusRes = await fetch(`${apiBase}/v1/jobs/${jobId}`);
            if (!statusRes.ok) throw new Error('Status check failed');
            statusData = await statusRes.json();
            if (statusData.status === 'completed') break;
            if (statusData.status === 'failed' || statusData.status === 'cancelled') {
                throw new Error(statusData.error || 'Processing failed');
            }
            attempts += 1;
        }

        if (!statusData || statusData.status !== 'completed') {
            throw new Error('Job timed out');
        }

        const filesRes = await fetch(`${apiBase}/v1/jobs/${jobId}/files`);
        if (!filesRes.ok) throw new Error('File fetch failed');
        const files = await filesRes.json();
        videoUrl = files?.files?.[0]?.url;
        title = statusData?.title || preview?.title || 'Video Ready';

        if (!videoUrl) throw new Error('No video found');

        const safeTitle = title
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        const previewDuration = formatDuration(preview?.duration_seconds);
        const thumb = preview?.thumbnail_url;
        const downloadFileName = `${(title || 'video').replace(/[^a-z0-9\-_\s]/gi, '').trim().replace(/\s+/g, '_') || 'video'}.mp4`;

        resultBox.innerHTML = `
            <div class="result-box">
                ${thumb ? `<img src="${thumb}" alt="${safeTitle}" style="width:100%;max-width:460px;border-radius:12px;display:block;margin:0 auto 12px;object-fit:cover;">` : ''}
                <h3>${safeTitle}</h3>
                <p style="color: var(--text-light); margin-bottom: 1rem;">
                    ${previewDuration ? `Duration: ${previewDuration} · ` : ''}Your video is ready to download
                </p>
                <button class="download-result-btn" id="downloadReadyBtn">Download HD Video</button>
            </div>
        `;
        const readyBtn = qs('downloadReadyBtn');
        if (readyBtn) {
            readyBtn.addEventListener('click', async () => {
                readyBtn.disabled = true;
                readyBtn.textContent = 'Downloading...';
                try {
                    await triggerFileDownload(videoUrl, downloadFileName);
                    showNotification('Download started', 'success');
                } catch {
                    showNotification('Download failed', 'error');
                } finally {
                    readyBtn.disabled = false;
                    readyBtn.textContent = 'Download HD Video';
                }
            });
        }
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
