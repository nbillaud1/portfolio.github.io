document.addEventListener('DOMContentLoaded', () => {
    
    // --- GESTION DE L'INTRO ---
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

    // --- CARROUSEL ---
    const cards = document.querySelectorAll('.card');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    let currentIndex = 0;

    function updateCarousel() {
        // Reset classes
        cards.forEach(card => {
            card.className = 'card';
        });

        // Calcul des index
        // prevIndex : index précédent (si 0, on va à la fin)
        const prevIndex = (currentIndex - 1 + cards.length) % cards.length;
        // nextIndex : index suivant (si fin, on revient à 0)
        const nextIndex = (currentIndex + 1) % cards.length;

        // Application des classes
        cards[currentIndex].classList.add('active');
        cards[prevIndex].classList.add('prev-card');
        cards[nextIndex].classList.add('next-card');
    }

    // Écouteurs d'événements
    btnNext.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % cards.length;
        updateCarousel();
    });

    btnPrev.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + cards.length) % cards.length;
        updateCarousel();
    });

    // Clavier
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') btnNext.click();
        if (e.key === 'ArrowLeft') btnPrev.click();
    });

    // Initialisation
    updateCarousel();
});