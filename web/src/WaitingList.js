import React, { useState } from 'react';
import './WaitingList.css'; // We'll create this CSS file

const WaitingList = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/waitinglist/subscribe/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name }),
      });

      if (response.ok) {
        setMessage('Merci ! Vous êtes maintenant sur la liste d\'attente de GoShopper. Nous vous tiendrons informé du lancement.');
        setEmail('');
        setName('');
      } else {
        const error = await response.json();
        setMessage(error.message || 'Une erreur s\'est produite. Veuillez réessayer.');
      }
    } catch (error) {
      setMessage('Erreur de connexion. Veuillez vérifier votre connexion internet et réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="waiting-list-page">
      <div className="waiting-list-container">
        <div className="waiting-list-header">
          <h1>Rejoignez la Liste d'Attente de GoShopper</h1>
          <p className="subtitle">L'App qui vous fait économiser sur vos courses en RD Congo !</p>
        </div>

        <div className="waiting-list-content">
          <div className="features">
            <div className="feature">
              <i className="fas fa-camera"></i>
              <h3>Scan de Reçus Intelligent</h3>
              <p>Scannez vos reçus avec l'IA Gemini pour un suivi automatique de vos dépenses.</p>
            </div>
            <div className="feature">
              <i className="fas fa-chart-line"></i>
              <h3>Comparaison de Prix</h3>
              <p>Comparez les prix entre les magasins et trouvez les meilleures affaires.</p>
            </div>
            <div className="feature">
              <i className="fas fa-bell"></i>
              <h3>Alertes de Prix</h3>
              <p>Recevez des notifications quand les prix baissent sur vos produits préférés.</p>
            </div>
          </div>

          <div className="signup-form">
            <h2>Soyez parmi les premiers à découvrir GoShopper !</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Votre nom (optionnel)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <input
                  type="email"
                  placeholder="Votre email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="form-input"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="submit-btn"
              >
                {isSubmitting ? 'Inscription...' : 'M\'inscrire'}
              </button>
            </form>
            {message && (
              <div className={`message ${message.includes('Merci') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}
          </div>

          <div className="app-preview">
            <div className="phone-mockup">
              <img src="/assets/images/goshopper-app-preview.png" alt="GoShopper App Preview" />
            </div>
            <div className="app-info">
              <h3>Téléchargez bientôt sur</h3>
              <div className="store-links">
                <a href="#" className="store-link google-play">
                  <i className="fab fa-google-play"></i>
                  Google Play
                </a>
                <a href="#" className="store-link app-store">
                  <i className="fab fa-app-store-ios"></i>
                  App Store
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaitingList;