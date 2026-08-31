console.log("PortAL: Professional Career Platform Initialized");

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Hero Section Apply Now Interactive Logic
document.addEventListener('click', function(e) {
    const container = document.getElementById('apply-container');
    if (!container) return;

    // 1. Initial Click on Apply Now
    if (e.target && e.target.id === 'hero-apply-btn') {
        container.innerHTML = `
            <div class="d-flex gap-2 animate-fade-in">
                <button id="confirm-apply-btn" class="btn btn-success w-100 py-2">
                    <i class="fas fa-check me-2"></i>Confirm
                </button>
                <button id="cancel-apply-btn" class="btn btn-light w-100 py-2 border">
                    <i class="fas fa-times me-2"></i>Cancel
                </button>
            </div>
        `;
    }

    // 2. Click on Confirm
    if (e.target && (e.target.id === 'confirm-apply-btn' || e.target.closest('#confirm-apply-btn'))) {
        container.innerHTML = `
            <div class="alert alert-success mb-0 py-2 text-center animate-fade-in small fw-bold">
                <i class="fas fa-check-circle me-2"></i> Application Successfully Submitted!
            </div>
        `;
        // Optional: Reset after a few seconds
        setTimeout(() => {
            container.innerHTML = `<button class="btn btn-primary-custom w-100" id="hero-apply-btn">Apply Now</button>`;
        }, 3000);
    }

    // 3. Click on Cancel
    if (e.target && (e.target.id === 'cancel-apply-btn' || e.target.closest('#cancel-apply-btn'))) {
        // Discard changes and remove selected state
        container.innerHTML = `
            <button class="btn btn-primary-custom w-100" id="hero-apply-btn">Apply Now</button>
        `;
    }
});
