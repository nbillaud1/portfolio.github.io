document.addEventListener('DOMContentLoaded', () => {
    
    const enterBtn = document.getElementById('enter-btn');
    const introScreen = document.getElementById('intro-screen');
    const mainInterface = document.getElementById('main-interface');

    enterBtn.addEventListener('click', () => {
        introScreen.style.opacity = '0';
        setTimeout(() => {
            introScreen.style.display = 'none';
            mainInterface.classList.remove('hidden');
        }, 800);
    });

    const cards = document.querySelectorAll('.card');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    let currentIndex = 0;

    function updateCarousel() {
        cards.forEach(card => {
            card.className = 'card';
        });

        const prevIndex = (currentIndex - 1 + cards.length) % cards.length;
        const nextIndex = (currentIndex + 1) % cards.length;

        cards[currentIndex].classList.add('active');
        cards[prevIndex].classList.add('prev-card');
        cards[nextIndex].classList.add('next-card');
    }

    if(btnNext && btnPrev) {
        btnNext.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % cards.length;
            updateCarousel();
        });

        btnPrev.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + cards.length) % cards.length;
            updateCarousel();
        });
    }

    document.addEventListener('keydown', (e) => {
        const projectsView = document.getElementById('projects-view');
        if(projectsView && projectsView.classList.contains('active-view')) {
            if (e.key === 'ArrowRight') btnNext.click();
            if (e.key === 'ArrowLeft') btnPrev.click();
        }
    });

    if(cards.length > 0) updateCarousel();
});

function switchView(viewName) {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    event.currentTarget.classList.add('active');

    const projectsView = document.getElementById('projects-view');
    const skillsView = document.getElementById('skills-view');

    if (viewName === 'projects') {
        skillsView.classList.remove('active-view');
        setTimeout(() => {
            skillsView.classList.add('hidden');
            projectsView.classList.remove('hidden');
            setTimeout(() => projectsView.classList.add('active-view'), 50);
        }, 300);
        
    } else if (viewName === 'skills') {
        projectsView.classList.remove('active-view');
        setTimeout(() => {
            projectsView.classList.add('hidden');
            skillsView.classList.remove('hidden');
            setTimeout(() => skillsView.classList.add('active-view'), 50);
        }, 300);
    }
}