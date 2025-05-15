
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(tooltip => {
        new bootstrap.Tooltip(tooltip);
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
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

    // Example image blur toggle
    const exampleButtons = document.querySelectorAll('.example-image button');
    exampleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const img = this.previousElementSibling;
            if (img.style.filter === 'blur(10px)') {
                img.style.filter = 'none';
                this.textContent = 'Blur Image';
            } else {
                img.style.filter = 'blur(10px)';
                this.textContent = 'Show Image';
            }
        });
    });
});
