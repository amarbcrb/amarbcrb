/* Animations coupées seulement quand la page porte la classe calme (posée dans index.html) : tests automatiques
   en « mouvement réduit ». Le réglage du système seul ne les coupe plus (Windows l'active souvent pour tout l'ordinateur). */
export const RM = document.documentElement.classList.contains('calme');
