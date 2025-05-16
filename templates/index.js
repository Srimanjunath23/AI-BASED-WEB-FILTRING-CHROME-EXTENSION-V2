document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle
    const themeToggle = document.querySelector('.theme-toggle');
    const body = document.body;
    
    themeToggle.addEventListener('click', function() {
        body.classList.toggle('dark-mode');
        
        if (body.classList.contains('dark-mode')) {
            themeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
            localStorage.setItem('theme', 'dark');
        } else {
            themeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
            localStorage.setItem('theme', 'light');
        }
    });
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
    }
    
    // Accordion functionality
    const accordionButtons = document.querySelectorAll('.accordion-button');
    
    accordionButtons.forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('active');
            
            const content = this.parentElement.nextElementSibling;
            
            if (this.classList.contains('active')) {
                content.classList.add('active');
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                content.classList.remove('active');
                content.style.maxHeight = 0;
            }
            
            // Close other accordion items
            accordionButtons.forEach(otherButton => {
                if (otherButton !== this) {
                    otherButton.classList.remove('active');
                    const otherContent = otherButton.parentElement.nextElementSibling;
                    otherContent.classList.remove('active');
                    otherContent.style.maxHeight = 0;
                }
            });
        });
    });
    
    // Open first accordion by default
    if (accordionButtons.length > 0) {
        accordionButtons[0].click();
    }
    
    // Blur toggle for example image
    const blurToggle = document.querySelector('.blur-toggle');
    const blurredImage = document.querySelector('.image-container img');
    
    if (blurToggle && blurredImage) {
        blurToggle.addEventListener('click', function() {
            blurredImage.classList.toggle('blurred');
            
            if (blurredImage.classList.contains('blurred')) {
                this.innerHTML = '<i class="bi bi-eye"></i> Show Image';
            } else {
                this.innerHTML = '<i class="bi bi-eye-slash"></i> Blur Image';
            }
        });
    }
    
    // Sensitivity slider
    const sensitivityHandle = document.getElementById('sensitivityHandle');
    const sensitivityDescription = document.getElementById('sensitivityDescription');
    const sliderFill = document.querySelector('.slider-fill');
    
    if (sensitivityHandle && sliderFill) {
        let isDragging = false;
        let currentPosition = 50; // Default to medium (50%)
        
        const descriptions = [
            "Blocks only explicit harmful content",
            "Balanced protection for most users",
            "Maximum protection, may overblock"
        ];
        
        function updateSlider(position) {
            // Clamp position between 0 and 100
            position = Math.max(0, Math.min(100, position));
            
            // Update slider position
            sensitivityHandle.style.left = position + '%';
            sliderFill.style.width = position + '%';
            
            // Update description based on position
            let descriptionIndex;
            if (position < 33) {
                descriptionIndex = 0; // Low
            } else if (position < 66) {
                descriptionIndex = 1; // Medium
            } else {
                descriptionIndex = 2; // High
            }
            
            sensitivityDescription.textContent = descriptions[descriptionIndex];
            
            currentPosition = position;
        }
        
        // Initial position (medium)
        updateSlider(currentPosition);
        
        // Mouse events for dragging
        sensitivityHandle.addEventListener('mousedown', function(e) {
            isDragging = true;
            e.preventDefault(); // Prevent text selection
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            
            const sliderTrack = document.querySelector('.slider-track');
            const rect = sliderTrack.getBoundingClientRect();
            const position = ((e.clientX - rect.left) / rect.width) * 100;
            
            updateSlider(position);
        });
        
        document.addEventListener('mouseup', function() {
            isDragging = false;
        });
        
        // Touch events for mobile
        sensitivityHandle.addEventListener('touchstart', function(e) {
            isDragging = true;
        });
        
        document.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            
            const touch = e.touches[0];
            const sliderTrack = document.querySelector('.slider-track');
            const rect = sliderTrack.getBoundingClientRect();
            const position = ((touch.clientX - rect.left) / rect.width) * 100;
            
            updateSlider(position);
        });
        
        document.addEventListener('touchend', function() {
            isDragging = false;
        });
        
        // Click on track to jump
        const sliderTrack = document.querySelector('.slider-track');
        sliderTrack.addEventListener('click', function(e) {
            const rect = this.getBoundingClientRect();
            const position = ((e.clientX - rect.left) / rect.width) * 100;
            
            updateSlider(position);
        });
    }
    
    // Scroll reveal animation
    const scrollReveal = function() {
        const sections = document.querySelectorAll('.scroll-reveal');
        
        sections.forEach(section => {
            const sectionTop = section.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (sectionTop < windowHeight * 0.85) {
                section.classList.add('visible');
            }
        });
    };
    
    // Run on load
    scrollReveal();
    
    // Run on scroll
    window.addEventListener('scroll', scrollReveal);
});