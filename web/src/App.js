import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import './App.css';

// Firebase configuration for admin
// These values come from environment variables
const FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const APP_ID = 'goshopper';

// Component to handle internal page scrolling
function ScrollLink({ to, children, className, onClick }) {
  
  const handleClick = (e) => {
    if (to.startsWith('#')) {
      e.preventDefault();
      const element = document.getElementById(to.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (to.includes('#')) {
      e.preventDefault();
      const [path, hash] = to.split('#');
      if (window.location.pathname !== path) {
        window.location.href = to;
      } else {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
    if (onClick) onClick();
  };

  if (to.startsWith('#') || to.includes('#')) {
    return (
      <a href={to} className={className} onClick={handleClick}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="app-header">
      <nav className="nav-container">
        <Link to="/" className="nav-brand">
          <div className="logo">
            <img src="/logo.png" alt="GoShopper" className="logo-icon" />
            <span className="logo-text">GoShopper</span>
          </div>
        </Link>
        <div className={`nav-links ${mobileMenuOpen ? 'nav-open' : ''}`}>
          <ScrollLink to="/#features" onClick={closeMobileMenu}>Fonctionnalités</ScrollLink>
          <ScrollLink to="/#download" onClick={closeMobileMenu}>Télécharger</ScrollLink>
          <ScrollLink to="/privacy" onClick={closeMobileMenu}>Confidentialité</ScrollLink>
          <ScrollLink to="/terms" onClick={closeMobileMenu}>Conditions</ScrollLink>
          <ScrollLink to="/support" onClick={closeMobileMenu}>Support</ScrollLink>
        </div>
        <div className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          <div className={`hamburger ${mobileMenuOpen ? 'active' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </nav>
    </header>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Navigation />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomeSection />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsConditions />} />
            <Route path="/support" element={<Support />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <div className="footer-container">
            <div className="footer-brand">
              <div className="logo" itemScope itemType="https://schema.org/Organization">
                <img src="/logo.png" alt="GoShopper - Application de scan de reçus RDC" className="logo-icon" itemProp="logo" />
                <span className="logo-text" itemProp="name">GoShopper</span>
              </div>
              <p className="footer-desc" itemProp="description">Application révolutionnaire avec IA pour scan de reçus, comparaison de prix et mobile money en République Démocratique du Congo</p>
            </div>
            <div className="footer-links">
              <div className="footer-column">
                <h4>Produit</h4>
                <ScrollLink to="/#features">Fonctionnalités</ScrollLink>
                <ScrollLink to="/#download">Télécharger</ScrollLink>
              </div>
              <div className="footer-column">
                <h4>Juridique</h4>
                <ScrollLink to="/privacy">Politique de confidentialité</ScrollLink>
                <ScrollLink to="/terms">Conditions générales</ScrollLink>
              </div>
              <div className="footer-column">
                <h4>Support</h4>
                <ScrollLink to="/support">Centre d'aide</ScrollLink>
                <a href="mailto:support@goshopper.app" itemProp="email">Nous contacter</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} GoShopper. All rights reserved. | Property of <a href="https://www.africaniteservices.com" target="_blank" rel="noopener noreferrer" style={{color: 'inherit', textDecoration: 'underline'}}>Africanite Services</a></p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

function HomeSection() {
  useEffect(() => {
    document.title = 'GoShopper - Scan de Reçus Intelligent et Gestion de Budget';
    
    // Update meta description for home page
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Application mobile révolutionnaire avec IA pour scanner vos reçus, analyser vos dépenses et optimiser votre budget. Support mobile money et paiements sécurisés.');
    }
    
    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', 'GoShopper - Scan de Reçus Intelligent et Comparaison de Prix en RDC');
    }
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', 'https://goshopper.app/');
    }
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Transformez vos Reçus grâce à l'<span className="gradient-text">Intelligence Artificielle</span>
            </h1>
            <p className="hero-subtitle">
              Transformez vos reçus en données organisées en quelques secondes. GoShopper utilise l'IA avancée pour extraire automatiquement chaque détail et analyser vos habitudes d'achat.
            </p>
            <div className="hero-buttons">
              <ScrollLink to="#download" className="btn btn-primary">
                <span className="btn-icon">📱</span>
                Télécharger gratuitement
              </ScrollLink>
              <ScrollLink to="#features" className="btn btn-secondary">
                <span className="btn-icon">✨</span>
                En savoir plus
              </ScrollLink>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <div className="stat-number">10k+</div>
                <div className="stat-label">Utilisateurs actifs</div>
              </div>
              <div className="stat">
                <div className="stat-number">99.9%</div>
                <div className="stat-label">Précision</div>
              </div>
              <div className="stat">
                <div className="stat-number">5⭐</div>
                <div className="stat-label">Note App Store</div>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="phone-mockup">
              <div className="phone-screen">
                <img src="/app-screenshot.jpg" alt="Interface de l'application GoShopper montrant le scan de reçus intelligent et la gestion des dépenses" className="app-screenshot" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="section-container">
          <div className="section-header">
            <h2>Pourquoi Choisir GoShopper ?</h2>
            <p>Découvrez l'avenir de la gestion des dépenses avec nos fonctionnalités révolutionnaires</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <h3>Scan IA Précis et Universel</h3>
              <p>Intelligence artificielle avancée qui extrait automatiquement texte, prix et catégories de vos reçus avec 99,9% de précision, peu importe le format.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Fonctionnement Hors Ligne</h3>
              <p>Scannez vos reçus même sans connexion internet. Synchronisation automatique dès le retour en ligne.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏷️</div>
              <h3>Catégorisation Intelligente</h3>
              <p>La catégorisation automatique des dépenses apprend de vos habitudes de dépenses pour une organisation personnalisée.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Analyses des dépenses</h3>
              <p>Des insights détaillés et des graphiques vous aident à comprendre vos habitudes de dépenses et à économiser de l'argent.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Sécurité de niveau bancaire</h3>
              <p>Vos données financières sont protégées par un cryptage de niveau entreprise et un stockage cloud sécurisé.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🌍</div>
              <h3>Multilingue</h3>
              <p>Prend en charge les reçus en français, anglais et langues locales avec compréhension du contexte culturel.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="section-container">
          <div className="section-header">
            <h2>Comment ça marche</h2>
            <p>Trois étapes simples pour transformer vos reçus</p>
          </div>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Prenez une photo</h3>
                <p>Prenez une photo de votre reçu avec l'appareil photo de votre téléphone</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>L'IA extrait les données</h3>
                <p>Notre IA lit instantanément et organise toutes les informations du reçu</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Suivez et analysez</h3>
                <p>Consultez des rapports de dépenses détaillés et des insights dans votre tableau de bord</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="download">
        <div className="section-container">
          <div className="download-content">
            <h2>Prêt à commencer ?</h2>
            <p>Rejoignez des milliers d'utilisateurs qui économisent déjà du temps et de l'argent avec GoShopper</p>
            <div className="download-buttons">
              <a href="#" className="download-btn android">
                <div className="download-icon google-play">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                  </svg>
                </div>
                <div className="download-text">
                  <span className="download-label">Téléchargez sur</span>
                  <span className="download-store">Google Play</span>
                </div>
              </a>
              <a href="#" className="download-btn ios">
                <div className="download-icon app-store">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.18 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z"/>
                  </svg>
                </div>
                <div className="download-text">
                  <span className="download-label">Téléchargez sur</span>
                  <span className="download-store">l'App Store</span>
                </div>
              </a>
            </div>
            <p className="download-note">Téléchargement gratuit • 30 jours d'essai gratuit • Aucune carte de crédit requise</p>
          </div>
        </div>
      </section>
    </>
  );
}

function PrivacyPolicy() {
  useEffect(() => {
    document.title = 'Politique de Confidentialité | GoShopper - Protection des Données';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Politique de confidentialité complète de GoShopper - Protection maximale de vos données personnelles conforme RGPD, CCPA et réglementations internationales.');
    }
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', 'Politique de Confidentialité | GoShopper');
    }
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', 'https://goshopper.app/privacy');
    }
  }, []);

  return (
    <section className="legal-page">
      <div className="legal-container">
        <div className="legal-header">
          <h1>Politique de Confidentialité</h1>
          <p className="legal-date">Dernière mise à jour : 17 décembre 2025</p>
          <p className="legal-version">Version 2.0</p>
        </div>
        
        <div className="legal-content">
          <div className="legal-section">
            <h2>1. INTRODUCTION</h2>
            <p>GoShopper ("nous", "notre", "nos", "la Société") exploite l'application mobile GoShopper ("l'Application", "le Service"). Cette politique de confidentialité ("Politique") vous informe de nos pratiques concernant la collecte, l'utilisation, la divulgation et la protection de vos informations personnelles lorsque vous utilisez notre Service.</p>
            <p><strong>EN UTILISANT NOTRE SERVICE, VOUS CONSENTEZ À LA COLLECTE, L'UTILISATION ET LA DIVULGATION DE VOS INFORMATIONS CONFORMÉMENT À CETTE POLITIQUE.</strong></p>
          </div>

          <div className="legal-section">
            <h2>2. INFORMATIONS COLLECTÉES</h2>
            
            <h3>2.1 Informations Fournies Volontairement</h3>
            <ul>
              <li><strong>Informations de Compte :</strong> Adresse e-mail, nom, photo de profil (lors de l'inscription via Google, Apple, ou création manuelle)</li>
              <li><strong>Données de Reçus :</strong> Images de reçus scannés, noms de magasins, produits, prix, dates</li>
              <li><strong>Listes d'Achats :</strong> Articles ajoutés à vos listes personnelles</li>
              <li><strong>Préférences :</strong> Paramètres de l'application, magasins favoris, préférences de notification</li>
              <li><strong>Communications :</strong> Messages envoyés via notre support client</li>
            </ul>

            <h3>2.2 Informations Collectées Automatiquement</h3>
            <ul>
              <li><strong>Informations d'Appareil :</strong> Modèle, système d'exploitation, identifiants uniques d'appareil</li>
              <li><strong>Données d'Utilisation :</strong> Fonctionnalités utilisées, temps passé dans l'app, fréquence d'utilisation, interactions</li>
              <li><strong>Données de Localisation :</strong> Localisation approximative (ville/région) pour afficher les magasins à proximité (uniquement avec votre permission explicite)</li>
              <li><strong>Données Analytiques :</strong> Rapports de plantage, métriques de performance, erreurs d'application</li>
              <li><strong>Informations de Connexion :</strong> Adresse IP, informations de session, journaux d'activité</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>3. UTILISATION DES INFORMATIONS</h2>
            <p>Nous utilisons vos données exclusivement pour :</p>
            <ul>
              <li><strong>Fonctionnalité de Base :</strong> Traitement et analyse des données de reçus, suivi des prix, génération d'insights de dépenses</li>
              <li><strong>Authentification et Sécurité :</strong> Création et gestion de comptes, vérification d'identité, prévention de fraude</li>
              <li><strong>Personnalisation :</strong> Adaptation de l'expérience utilisateur, recommandations personnalisées</li>
              <li><strong>Amélioration du Service :</strong> Développement de fonctionnalités, amélioration de la précision d'analyse, correction d'erreurs</li>
              <li><strong>Support Client :</strong> Fourniture d'assistance technique et réponse aux demandes</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>4. BASE LÉGALE DU TRAITEMENT (RGPD)</h2>
            <p>Nous traitons vos données personnelles sur la base de :</p>
            <ul>
              <li><strong>Exécution du Contrat :</strong> Fourniture du service que vous avez demandé</li>
              <li><strong>Intérêts Légitimes :</strong> Amélioration du service, prévention de fraude, sécurité</li>
              <li><strong>Consentement :</strong> Marketing, géolocalisation, cookies non essentiels</li>
              <li><strong>Obligation Légale :</strong> Conformité aux lois applicables</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>5. PARTAGE ET DIVULGATION DES DONNÉES</h2>
            
            <h3>5.1 Nous NE Partageons JAMAIS</h3>
            <ul>
              <li>Vos informations personnelles à des fins commerciales</li>
              <li>Vos données de reçus avec des tiers non autorisés</li>
              <li>Vos informations avec des annonceurs ou brokers de données</li>
              <li>Vos données financières à des fins de marketing</li>
            </ul>

            <h3>5.2 Partage Autorisé Uniquement</h3>
            <ul>
              <li><strong>Prestataires de Services :</strong> Services d'hébergement cloud sécurisés, services d'authentification (sous accords de confidentialité stricts)</li>
              <li><strong>Obligations Légales :</strong> Lorsque requis par la loi, ordonnances judiciaires, ou pour protéger nos droits légaux</li>
              <li><strong>Protection de Sécurité :</strong> Prévention de fraude, protection contre les cyberattaques</li>
              <li><strong>Consentement Explicite :</strong> Uniquement si vous donnez votre autorisation spécifique</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>6. SÉCURITÉ ET PROTECTION DES DONNÉES</h2>
            <ul>
              <li><strong>Chiffrement :</strong> Chiffrement AES-256 pour toutes les données en transit et au repos</li>
              <li><strong>Authentification Sécurisée :</strong> OAuth 2.0, authentification multi-facteurs optionnelle</li>
              <li><strong>Contrôles d'Accès :</strong> Accès basé sur les rôles, authentification forte des employés</li>
              <li><strong>Surveillance :</strong> Monitoring continu des activités suspectes, journaux d'audit complets</li>
              <li><strong>Traitement Local :</strong> Le traitement intelligent des reçus est effectué localement sur votre appareil lorsque possible</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>7. VOS DROITS ET CONTRÔLES</h2>
            <ul>
              <li><strong>Accès :</strong> Obtenir une copie complète de toutes vos données personnelles</li>
              <li><strong>Rectification :</strong> Corriger les informations inexactes ou incomplètes</li>
              <li><strong>Suppression :</strong> Demander la suppression définitive de votre compte et données ("droit à l'oubli")</li>
              <li><strong>Portabilité :</strong> Exporter vos données dans un format structuré et lisible</li>
              <li><strong>Opposition :</strong> Vous opposer au traitement de vos données pour des finalités spécifiques</li>
              <li><strong>Retrait de Consentement :</strong> Révoquer vos consentements à tout moment</li>
            </ul>
            
            <h3>Comment Exercer vos Droits</h3>
            <p>Contactez-nous à <strong>privacy@goshopper.app</strong> avec votre demande spécifique et une preuve d'identité. Délai de réponse : 30 jours maximum.</p>
          </div>

          <div className="legal-section">
            <h2>8. CONSERVATION DES DONNÉES</h2>
            <ul>
              <li><strong>Données de Compte :</strong> Conservées tant que votre compte est actif</li>
              <li><strong>Images de Reçus :</strong> Conservées jusqu'à suppression manuelle ou fermeture du compte</li>
              <li><strong>Données d'Usage :</strong> Conservées pendant 24 mois maximum</li>
              <li><strong>Journaux de Sécurité :</strong> Conservés pendant 12 mois</li>
            </ul>
            <p>Les données supprimées sont définitivement effacées dans les 30 jours.</p>
          </div>

          <div className="legal-section">
            <h2>9. CONFIDENTIALITÉ DES MINEURS</h2>
            <ul>
              <li>Service non destiné aux enfants de moins de 13 ans</li>
              <li>Vérification de l'âge lors de l'inscription</li>
              <li>Suppression immédiate des données si utilisation par un mineur détectée</li>
              <li>Consentement parental requis pour les utilisateurs de 13-16 ans (selon juridiction)</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>10. CONFORMITÉ RÉGLEMENTAIRE</h2>
            <p>Cette politique respecte :</p>
            <ul>
              <li><strong>RGPD</strong> (Règlement Général sur la Protection des Données) - Union Européenne</li>
              <li><strong>CCPA</strong> (California Consumer Privacy Act) - Californie, États-Unis</li>
              <li><strong>COPPA</strong> (Children's Online Privacy Protection Act) - États-Unis</li>
              <li><strong>Loi Informatique et Libertés</strong> - France</li>
              <li>Autres réglementations locales applicables</li>
            </ul>
            <p><strong>Représentant UE :</strong> eu-representative@goshopper.app</p>
          </div>

          <div className="legal-section">
            <h2>11. VIOLATIONS DE DONNÉES</h2>
            <p>En cas de violation de données personnelles :</p>
            <ul>
              <li>Notification aux autorités compétentes dans les 72 heures</li>
              <li>Information des utilisateurs affectés si risque élevé</li>
              <li>Mesures correctives immédiates</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>12. DONNÉES DE PRIX COMMUNAUTAIRES</h2>
            <p>Lorsque vous scannez des reçus, nous collectons et anonymisons les prix des produits, informations de magasin et données d'achat. Les données de prix sont complètement anonymisées et ne contiennent aucune information pouvant vous identifier personnellement. Les données communautaires anonymisées aident à fournir de meilleures comparaisons de prix pour tous les utilisateurs.</p>
          </div>

          <div className="legal-section">
            <h2>13. CONTRIBUTION AUX DONNÉES COMMUNAUTAIRES</h2>
            <p>Par défaut, votre numérisation de reçus contribue à notre base de données de prix communautaire anonymisée. Vous pouvez contrôler cela :</p>
            <ul>
              <li><strong>Désinscription :</strong> Désactivez la contribution aux données communautaires dans Paramètres > Confidentialité > Données communautaires</li>
              <li><strong>Effet :</strong> Lorsque désactivé, vos données de prix ne seront pas partagées avec la communauté</li>
              <li><strong>Impact :</strong> Les comparaisons de prix peuvent être moins complètes mais restent fonctionnelles</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>14. SUPPRESSION DES DONNÉES</h2>
            <p>Vous pouvez demander la suppression de vos données personnelles :</p>
            <ul>
              <li><strong>Suppression de Compte :</strong> Supprimez votre compte via les paramètres de l'application</li>
              <li><strong>Suppression des Données :</strong> Toutes les données personnelles sont supprimées définitivement dans les 30 jours</li>
              <li><strong>Images de Reçus :</strong> Les images originales de reçus sont supprimées immédiatement</li>
              <li><strong>Données Communautaires :</strong> Les données de prix anonymisées restent pour maintenir la qualité du service</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>15. MODIFICATIONS DE CETTE POLITIQUE</h2>
            <ul>
              <li>Notification via l'application pour modifications importantes</li>
              <li>E-mail de notification aux utilisateurs enregistrés</li>
              <li>Publication de la nouvelle version sur notre site web</li>
              <li>Période de préavis de 30 jours pour changements substantiels</li>
            </ul>
            <p>L'utilisation continue du service après modifications constitue votre acceptation de la politique révisée.</p>
          </div>

          <div className="legal-section">
            <h2>16. CONTACT ET RÉCLAMATIONS</h2>
            <div className="contact-info">
              <p><strong>E-mail Confidentialité :</strong> privacy@goshopper.app</p>
              <p><strong>Support Général :</strong> support@goshopper.app</p>
              <p><strong>Site Web :</strong> https://goshopper.app/privacy</p>
              <p><strong>Délégué à la Protection des Données :</strong> dpo@goshopper.app</p>
            </div>
            
            <h3>Réclamations</h3>
            <ul>
              <li>Droit de déposer une plainte auprès de l'autorité de supervision compétente</li>
              <li><strong>France :</strong> Commission Nationale de l'Informatique et des Libertés (CNIL)</li>
              <li><strong>UE :</strong> Autorité de protection des données de votre pays de résidence</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>14. JURIDICTION ET LOI APPLICABLE</h2>
            <p>Cette Politique est régie par les lois françaises et européennes. Tout litige sera soumis à la compétence exclusive des tribunaux français, sans préjudice de vos droits en tant que consommateur.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TermsConditions() {
  useEffect(() => {
    document.title = 'Conditions Générales d\'Utilisation | GoShopper - Protection Légale Complète';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Conditions générales complètes de GoShopper - Termes juridiquement contraignants, protection maximale et utilisation responsable de notre application IA.');
    }
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', 'Conditions Générales | GoShopper');
    }
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', 'https://goshopper.app/terms');
    }
  }, []);

  return (
    <section className="legal-page">
      <div className="legal-container">
        <div className="legal-header">
          <h1>Conditions Générales d'Utilisation</h1>
          <p className="legal-date">Dernière mise à jour : 17 décembre 2025</p>
          <p className="legal-version">Version 2.0</p>
        </div>
        
        <div className="legal-content">
          <div className="legal-section">
            <h2>1. ACCEPTATION DES CONDITIONS</h2>
            <p>En téléchargeant, installant, accédant ou utilisant l'application mobile GoShopper ("l'Application", "le Service"), vous acceptez d'être juridiquement lié par les présentes Conditions Générales d'Utilisation ("Conditions", "CGU"). Ces Conditions constituent un accord juridiquement contraignant entre vous ("Utilisateur", "vous", "votre") et GoShopper ("nous", "notre", "nos", "la Société").</p>
            <p><strong>SI VOUS N'ACCEPTEZ PAS CES CONDITIONS DANS LEUR INTÉGRALITÉ, VOUS N'ÊTES PAS AUTORISÉ À UTILISER LE SERVICE ET DEVEZ IMMÉDIATEMENT CESSER TOUTE UTILISATION.</strong></p>
          </div>

          <div className="legal-section">
            <h2>2. DESCRIPTION DU SERVICE</h2>
            <p>GoShopper est une application mobile utilisant l'intelligence artificielle qui fournit :</p>
            <ul>
              <li><strong>Numérisation Intelligente :</strong> Scan et extraction automatique de données des reçus</li>
              <li><strong>Analyse des Dépenses :</strong> Suivi, catégorisation et analyse de vos achats</li>
              <li><strong>Gestion Budgétaire :</strong> Outils de planification et optimisation des dépenses</li>
              <li><strong>Synchronisation Multi-Appareils :</strong> Accès à vos données sur plusieurs dispositifs</li>
              <li><strong>Alertes Personnalisées :</strong> Notifications basées sur vos habitudes d'achat</li>
              <li><strong>Insights IA :</strong> Recommandations personnalisées pour optimiser votre budget</li>
            </ul>
            <p>Le Service est fourni "en l'état" et "selon disponibilité". Nous nous réservons le droit de modifier, suspendre ou interrompre tout ou partie du Service à tout moment.</p>
          </div>

          <div className="legal-section">
            <h2>3. ADMISSIBILITÉ ET COMPTES UTILISATEURS</h2>
            
            <h3>3.1 Conditions d'Admissibilité</h3>
            <ul>
              <li><strong>Âge Minimum :</strong> Vous devez avoir au moins 13 ans pour utiliser le Service</li>
              <li><strong>Consentement Parental :</strong> Les utilisateurs de 13-18 ans doivent obtenir le consentement de leurs parents/tuteurs</li>
              <li><strong>Capacité Juridique :</strong> Vous devez avoir la capacité juridique de conclure des contrats contraignants</li>
              <li><strong>Juridiction :</strong> L'utilisation du Service doit être légale dans votre juridiction</li>
            </ul>

            <h3>3.2 Création et Gestion de Compte</h3>
            <ul>
              <li><strong>Informations Exactes :</strong> Vous devez fournir des informations complètes, exactes et à jour</li>
              <li><strong>Unicité du Compte :</strong> Un seul compte par personne physique</li>
              <li><strong>Responsabilité :</strong> Vous êtes entièrement responsable de toutes activités sous votre compte</li>
              <li><strong>Sécurité :</strong> Vous devez maintenir la confidentialité de vos identifiants de connexion</li>
              <li><strong>Notification :</strong> Vous devez nous informer immédiatement de toute utilisation non autorisée</li>
            </ul>

            <h3>3.3 Suspension et Résiliation de Compte</h3>
            <p>Nous pouvons suspendre ou résilier votre compte immédiatement et sans préavis si vous violez ces Conditions, utilisez le Service de manière frauduleuse, portez atteinte aux droits d'autrui, ou présentez des activités suspectes.</p>
          </div>

          <div className="legal-section">
            <h2>4. FONCTIONNALITÉS COMMUNAUTAIRES ET PARTAGE DE DONNÉES</h2>
            <p>En utilisant la fonction de numérisation de reçus, vous contribuez à notre base de données communautaire de prix. Toutes les données de prix sont complètement anonymisées avant d'être partagées avec la communauté. Aucune information personnelle ou identifiant utilisateur n'est inclus dans les données communautaires. Les données communautaires aident à fournir de meilleures comparaisons de prix pour tous les utilisateurs.</p>

            <h3>4.1 Anonymisation des Données</h3>
            <p>Les noms de produits, prix et informations de magasin sont anonymisés. Les identifiants utilisateurs, noms, emails et autres données personnelles ne sont jamais partagés. Vous pouvez vous désinscrire de la contribution aux données communautaires dans les paramètres de l'application. Les fonctionnalités communautaires fonctionnent avec ou sans votre contribution de données.</p>

            <h3>4.2 Avantages Communautaires</h3>
            <p>Accès à des comparaisons de prix complètes sur plusieurs magasins. Suivi historique des prix et tendances. Meilleurs insights d'achat et opportunités d'économies. Amélioration du service pour tous les utilisateurs grâce aux données collectives.</p>

            <h3>4.3 Désinscription des Données Communautaires</h3>
            <p>Vous avez le droit de vous désinscrire de la contribution à notre base de données de prix communautaire :</p>
            <ul>
              <li><strong>Comment se désinscrire :</strong> Paramètres > Confidentialité > Données communautaires et désactiver la fonctionnalité</li>
              <li><strong>Effet de la désinscription :</strong> Vos données de reçus ne seront pas anonymisées et partagées avec la communauté</li>
              <li><strong>Continuité du service :</strong> Toutes les autres fonctionnalités de l'application restent pleinement fonctionnelles</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>5. UTILISATION ACCEPTABLE</h2>
            
            <h3>4.1 Usages Autorisés</h3>
            <ul>
              <li>Vos besoins personnels et non commerciaux</li>
              <li>Scanner et analyser vos propres reçus et tickets de caisse</li>
              <li>Gérer vos dépenses personnelles et budgets familiaux</li>
              <li>Accéder aux fonctionnalités selon les limites de votre plan d'abonnement</li>
            </ul>

            <h3>4.2 Activités Strictement Interdites</h3>
            <ul>
              <li><strong>Utilisation Frauduleuse :</strong> Scanner de faux reçus, manipuler des données, créer de fausses informations</li>
              <li><strong>Violations Techniques :</strong> Tenter de pirater, décompiler, désosser, ou faire de l'ingénierie inverse de l'Application</li>
              <li><strong>Sécurité :</strong> Contourner les mesures de sécurité, accéder aux systèmes non autorisés, transmettre des malwares</li>
              <li><strong>Atteintes aux Droits :</strong> Violer les droits de propriété intellectuelle, usurper l'identité d'autrui, harceler d'autres utilisateurs</li>
              <li><strong>Usage Commercial :</strong> Revendre, redistribuer ou exploiter commercialement le Service sans autorisation écrite</li>
              <li><strong>Automatisation :</strong> Utiliser des robots, scrapers ou systèmes automatisés pour accéder au Service</li>
            </ul>

            <h3>4.3 Conséquences des Violations</h3>
            <p>Toute violation peut entraîner : suspension immédiate, résiliation définitive sans remboursement, poursuites judiciaires civiles et/ou pénales, réclamation de dommages-intérêts.</p>
          </div>

          <div className="legal-section">
            <h2>6. PROPRIÉTÉ INTELLECTUELLE</h2>
            <ul>
              <li><strong>Application :</strong> Tous les droits, titres et intérêts dans l'Application, y compris l'interface utilisateur, design, fonctionnalités et technologies propriétaires</li>
              <li><strong>Marques :</strong> Logo GoShopper, noms commerciaux, marques de service sont notre propriété exclusive</li>
              <li><strong>Technologies :</strong> Intelligence artificielle propriétaire, systèmes d'analyse avancés, bases de données exclusives</li>
              <li><strong>Licence Accordée :</strong> Nous vous accordons une licence limitée, non exclusive, non transférable, révocable pour utiliser l'Application exclusivement pour vos besoins personnels</li>
            </ul>
            <p>Vous conservez tous droits de propriété sur vos reçus et données personnelles, mais nous accordez une licence pour traiter vos données afin de fournir le Service.</p>
          </div>

          <div className="legal-section">
            <h2>7. PRÉCISION DES DONNÉES ET LIMITATION DE RESPONSABILITÉ</h2>
            
            <h3>6.1 Précision de l'Analyse Automatique</h3>
            <ul>
              <li><strong>Intelligence Artificielle :</strong> L'extraction de données des reçus utilise l'intelligence artificielle qui peut occasionnellement produire des erreurs</li>
              <li><strong>Vérification Requise :</strong> Vous devez toujours vérifier l'exactitude des données extraites avant de les utiliser</li>
              <li><strong>Amélioration Continue :</strong> Nous nous efforçons d'améliorer constamment la précision, mais ne garantissons pas une précision de 100%</li>
            </ul>

            <h3>6.2 Pas de Conseil Financier</h3>
            <ul>
              <li><strong>Outil d'Information :</strong> Le Service fournit des outils d'analyse et d'organisation, pas de conseils financiers professionnels</li>
              <li><strong>Responsabilité Utilisateur :</strong> Toutes décisions financières basées sur les données du Service sont de votre seule responsabilité</li>
              <li><strong>Consultation Professionnelle :</strong> Consultez un conseiller financier qualifié pour des décisions importantes</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>8. ABONNEMENTS, PAIEMENTS ET REMBOURSEMENTS</h2>
            <ul>
              <li><strong>Plans d'Abonnement :</strong> Plan gratuit avec fonctionnalités limitées et plans premium avec fonctionnalités avancées</li>
              <li><strong>Facturation Périodique :</strong> Les frais d'abonnement sont facturés à l'avance pour chaque période d'abonnement</li>
              <li><strong>Renouvellement Automatique :</strong> Les abonnements se renouvellent automatiquement sauf annulation</li>
              <li><strong>Moyens de Paiement :</strong> Cartes de crédit/débit, mobile money, et autres moyens disponibles</li>
              <li><strong>Annulation :</strong> Vous pouvez annuler à tout moment via les paramètres de l'Application</li>
              <li><strong>Remboursements :</strong> Régis par les politiques des app stores (Apple App Store, Google Play Store)</li>
              <li><strong>Modifications de Prix :</strong> Nous pouvons modifier les prix avec un préavis de 30 jours</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>9. GARANTIES ET EXCLUSIONS</h2>
            <p><strong>DANS LA MESURE MAXIMALE AUTORISÉE PAR LA LOI, LE SERVICE EST FOURNI "EN L'ÉTAT" ET "SELON DISPONIBILITÉ" SANS AUCUNE GARANTIE, EXPRESSE OU IMPLICITE, Y COMPRIS MAIS SANS S'Y LIMITER :</strong></p>
            <ul>
              <li><strong>Qualité Marchande</strong> et adaptation à un usage particulier</li>
              <li><strong>Non-Contrefaçon</strong> des droits de propriété intellectuelle</li>
              <li><strong>Fonctionnement Ininterrompu</strong> ou exempt d'erreurs</li>
              <li><strong>Exactitude</strong> du contenu ou des données</li>
              <li><strong>Sécurité</strong> complète contre toutes menaces</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>10. LIMITATION DE RESPONSABILITÉ</h2>
            <p><strong>DANS LA MESURE MAXIMALE AUTORISÉE PAR LA LOI, GOSHOPPER, SES DIRIGEANTS, EMPLOYÉS, AGENTS ET PARTENAIRES NE SERONT EN AUCUN CAS RESPONSABLES DE :</strong></p>
            <ul>
              <li><strong>Dommages Indirects :</strong> Perte de profits, d'économies, d'opportunités commerciales</li>
              <li><strong>Dommages Consécutifs :</strong> Interruption d'activité, perte de données, dommages réputation</li>
              <li><strong>Dommages Punitifs</strong> ou exemplaires</li>
              <li><strong>Préjudice Moral</strong> ou stress émotionnel</li>
            </ul>
            <p>Notre responsabilité totale envers vous ne dépassera jamais le montant total que vous avez payé pour le Service au cours des 12 derniers mois.</p>
          </div>

          <div className="legal-section">
            <h2>11. INDEMNISATION</h2>
            <p>Vous acceptez d'indemniser, défendre et dégager de toute responsabilité GoShopper contre toute réclamation, demande, dommage, perte, coût ou dépense découlant de :</p>
            <ul>
              <li>Votre utilisation du Service en violation de ces Conditions</li>
              <li>Votre violation de droits de tiers</li>
              <li>Votre négligence ou faute intentionnelle</li>
              <li>Tout contenu que vous soumettez via le Service</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>12. RÉSILIATION</h2>
            <p>Vous pouvez résilier votre compte à tout moment. Nous pouvons résilier ou suspendre votre accès immédiatement si vous violez ces Conditions, nous cessons de fournir le Service, votre compte reste inactif, ou nous déterminons que la résiliation est nécessaire.</p>
            <p>En cas de résiliation : votre droit d'utiliser le Service cesse immédiatement, nous pouvons supprimer votre compte et toutes vos données, aucun remboursement des frais payés (sauf exceptions légales).</p>
          </div>

          <div className="legal-section">
            <h2>13. FORCE MAJEURE</h2>
            <p>Nous ne serons pas responsables de tout retard ou défaut d'exécution résultant de circonstances indépendantes de notre volonté : catastrophes naturelles, guerres, grèves, défaillances d'infrastructure, actions gouvernementales, pandemies.</p>
          </div>

          <div className="legal-section">
            <h2>14. JURIDICTION ET LOI APPLICABLE</h2>
            <p>Ces Conditions sont régies par les lois françaises. Tout litige sera soumis à la compétence exclusive des tribunaux français, sous réserve des droits impératifs des consommateurs. Nous encourageons la résolution amiable des différends par négociation directe, médiation ou arbitrage.</p>
          </div>

          <div className="legal-section">
            <h2>15. CONFORMITÉ RÉGLEMENTAIRE</h2>
            <p>Le Service est développé en conformité avec :</p>
            <ul>
              <li>Réglementation européenne sur la protection des données (RGPD)</li>
              <li>Lois françaises sur l'informatique et les libertés</li>
              <li>Réglementations des app stores (Apple, Google)</li>
              <li>Standards de sécurité de l'industrie</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>16. DISPOSITIONS GÉNÉRALES</h2>
            <ul>
              <li><strong>Intégralité de l'Accord :</strong> Ces Conditions constituent l'intégralité de l'accord entre vous et nous</li>
              <li><strong>Divisibilité :</strong> Si une disposition est jugée invalide, les autres restent en vigueur</li>
              <li><strong>Cession :</strong> Vous ne pouvez pas céder vos droits sans notre consentement écrit</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>17. CONTACT ET SUPPORT</h2>
            <div className="contact-info">
              <p><strong>Support Technique :</strong> support@goshopper.app</p>
              <p><strong>Questions Légales :</strong> legal@goshopper.app</p>
              <p><strong>Confidentialité :</strong> privacy@goshopper.app</p>
              <p><strong>Site Web :</strong> https://goshopper.app</p>
            </div>
            
            <h3>Délais de Réponse</h3>
            <ul>
              <li>Support technique : 48 heures ouvrables</li>
              <li>Questions légales : 5 jours ouvrables</li>
              <li>Demandes de données personnelles : 30 jours (RGPD)</li>
            </ul>
          </div>

          <div className="legal-section legal-acceptance">
            <p><strong>EN UTILISANT LE SERVICE GOSHOPPER, VOUS RECONNAISSEZ AVOIR LU, COMPRIS ET ACCEPTÉ CES CONDITIONS GÉNÉRALES D'UTILISATION DANS LEUR INTÉGRALITÉ.</strong></p>
          </div>
        </div>
      </div>
    </section>
  );
}

function NotFound() {
  useEffect(() => {
    document.title = '404 - Page Non Trouvée | GoShopper - Erreur de Navigation';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Page non trouvée sur GoShopper. Retournez à l\'accueil pour découvrir notre application de scan de reçus et comparaison de prix en RDC.');
    }
  }, []);

  return (
    <section className="not-found-page">
      <div className="container">
        <div className="not-found-content">
          <h1>404</h1>
          <h2>Page non trouvée</h2>
          <p>Désolé, la page que vous recherchez n'existe pas.</p>
          <Link to="/" className="btn btn-primary">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </section>
  );
}

function Support() {
  useEffect(() => {
    document.title = 'Centre d\'Aide et Support | GoShopper - FAQ et Assistance RDC';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Centre d\'aide GoShopper - FAQ, guides d\'utilisation, support technique pour scan de reçus, mobile money et comparaison de prix en République Démocratique du Congo.');
    }
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', 'Centre d\'Aide et Support | GoShopper');
    }
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', 'https://goshopper.app/support');
    }
  }, []);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [activeCategory, setActiveCategory] = useState('general');
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('');

    try {
      // EmailJS configuration
      const result = await emailjs.send(
        'service_cydkyeu',
        'template_niz6gqw',
        {
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          time: new Date().toLocaleString(),
        },
        'gcVpnsQ20r5cXKudp'
      );

      if (result.status === 200) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('EmailJS Error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const faqCategories = {
    general: {
      title: 'Utilisation générale',
      items: [
        {
          id: 'scan-receipt',
          question: 'Comment scanner un ticket de caisse ?',
          answer: 'Ouvrez l\'app GoShopper, appuyez sur l\'onglet "Scanner" en bas de l\'écran, puis prenez une photo claire de votre ticket. L\'IA analysera automatiquement tous les articles, prix et détails du reçu. Assurez-vous que le ticket est bien éclairé et que tous les éléments sont visibles.'
        },
        {
          id: 'edit-scanned',
          question: 'Puis-je modifier les informations scannées ?',
          answer: 'Oui ! Après le scan, vous pouvez modifier tous les éléments : noms d\'articles, prix, quantités, et même ajouter ou supprimer des articles. Appuyez simplement sur l\'élément que vous souhaitez modifier dans la liste.'
        },
        {
          id: 'accuracy',
          question: 'Quelle est la précision de la numérisation ?',
          answer: 'GoShopper utilise une intelligence artificielle avancée pour atteindre une précision de plus de 95% sur les tickets clairs. L\'application traite intelligemment vos reçus pour extraire toutes les informations avec une grande précision.'
        },
        {
          id: 'offline',
          question: 'L\'application fonctionne-t-elle hors ligne ?',
          answer: 'Oui ! GoShopper peut scanner les tickets complètement hors ligne. Vos données se synchronisent automatiquement dès que vous vous reconnectez à Internet.'
        }
      ]
    },
    pricing: {
      title: 'Prix et abonnements',
      items: [
        {
          id: 'pricing-plans',
          question: 'Quels sont les tarifs d\'abonnement ?',
          answer: 'GoShopper propose : Plan Gratuit (3 scans/mois), Essai Gratuit (30 jours - 10 scans), Plan Basic (1,99$/mois ou 8 000 FC - 25 scans), Plan Standard (2,99$/mois ou 12 000 FC - 100 scans), Plan Premium (4,99$/mois ou 20 000 FC - 1,000 scans + statistiques avancées et fonctionnalités complètes).'
        },
        {
          id: 'payment-methods',
          question: 'Quels moyens de paiement sont acceptés ?',
          answer: 'En RDC : Mobile Money (M-Pesa, Orange Money, Airtel Money, AfriMoney) et cartes Visa. À l\'international : cartes Visa/Mastercard via Stripe. Tous les paiements sont sécurisés et chiffrés.'
        },
        {
          id: 'free-trial',
          question: 'Comment fonctionne l\'essai gratuit ?',
          answer: 'Nouveaux utilisateurs bénéficient de 30 jours d\'essai gratuit avec 10 scans inclus. Aucune carte de crédit requise. Accès à toutes les fonctionnalités premium pendant la période d\'essai. Après l\'essai, vous passez automatiquement au plan gratuit (3 scans/mois) sauf si vous choisissez un abonnement payant.'
        },
        {
          id: 'cancel-subscription',
          question: 'Comment annuler mon abonnement ?',
          answer: 'Vous pouvez annuler à tout moment dans Paramètres > Abonnement dans l\'app, ou via votre compte App Store/Google Play. Vos fonctionnalités premium restent actives jusqu\'à la fin de la période payée.'
        }
      ]
    },
    features: {
      title: 'Fonctionnalités',
      items: [
        {
          id: 'price-comparison',
          question: 'Comment fonctionne la comparaison de prix ?',
          answer: 'GoShopper analyse l\'historique de vos achats pour identifier des tendances de prix et vous suggérer des économies potentielles. Vous pouvez voir l\'évolution des prix pour chaque produit dans votre historique.'
        },
        {
          id: 'price-alerts',
          question: 'Comment créer des alertes de prix ?',
          answer: 'Allez dans Paramètres > Alertes de prix, ou appuyez sur l\'icône cloche à côté d\'un article. Définissez un prix cible et vous recevrez une notification pour suivre l\'évolution des prix de vos produits préférés.'
        },
        {
          id: 'export-data',
          question: 'Puis-je exporter mes données ?',
          answer: 'Oui ! Exportez vos listes d\'achats et historique au format PDF, CSV ou Excel. Parfait pour la comptabilité personnelle, les déclarations fiscales ou l\'analyse budgétaire.'
        },
        {
          id: 'ai-assistant',
          question: 'Comment utiliser l\'assistant IA ?',
          answer: 'L\'assistant IA analyse vos habitudes d\'achat pour vous suggérer des économies, alternatives de produits moins chers, et optimiser votre budget. Accessible via l\'onglet "Assistant" dans l\'app.'
        }
      ]
    },
    technical: {
      title: 'Problèmes techniques',
      items: [
        {
          id: 'scan-quality',
          question: 'Mes tickets ne se scannent pas correctement',
          answer: 'Assurez-vous : 1) Éclairage suffisant, 2) Ticket bien étalé sans plis, 3) Tenir le téléphone stable, 4) Cadrer tout le ticket dans l\'écran. Si le problème persiste, utilisez le mode correction manuelle.'
        },
        {
          id: 'sync-issues',
          question: 'Mes données ne se synchronisent pas',
          answer: 'Vérifiez votre connexion Internet. Les données se synchronisent automatiquement en arrière-plan. Si le problème persiste, redémarrez l\'app ou forcez la synchronisation depuis l\'indicateur de statut en haut de l\'écran.'
        },
        {
          id: 'app-crashes',
          question: 'L\'application plante souvent',
          answer: 'Essayez : 1) Redémarrer l\'app, 2) Vider le cache (Android), 3) Mettre à jour vers la dernière version, 4) Redémarrer votre téléphone. Si ça continue, contactez le support avec votre modèle de téléphone.'
        },
        {
          id: 'storage-space',
          question: 'L\'app prend trop d\'espace de stockage',
          answer: 'GoShopper optimise automatiquement le stockage. Vous pouvez supprimer les anciens tickets dans Historique > Gérer le stockage. Les données importantes restent synchronisées dans le cloud.'
        }
      ]
    },
    account: {
      title: 'Compte et sécurité',
      items: [
        {
          id: 'data-security',
          question: 'Mes données financières sont-elles sécurisées ?',
          answer: 'Absolument. GoShopper utilise un chiffrement de niveau bancaire, stockage cloud sécurisé, et ne collecte jamais d\'informations de carte bancaire. Toutes les données sont anonymisées et protégées.'
        },
        {
          id: 'account-deletion',
          question: 'Comment supprimer mon compte ?',
          answer: 'Allez dans Paramètres > Compte > Supprimer mes données. Attention : cette action est irréversible et supprimera définitivement tous vos tickets, historiques et paramètres.'
        },
        {
          id: 'data-backup',
          question: 'Mes données sont-elles sauvegardées ?',
          answer: 'Oui, toutes vos données sont automatiquement sauvegardées dans le cloud sécurisé. Si vous changez de téléphone, reconnectez-vous simplement pour récupérer toutes vos informations.'
        },
        {
          id: 'multiple-devices',
          question: 'Puis-je utiliser l\'app sur plusieurs appareils ?',
          answer: 'Oui ! Votre compte GoShopper se synchronise sur tous vos appareils. Téléchargez simplement l\'app et connectez-vous avec le même compte pour accéder à toutes vos données.'
        }
      ]
    }
  };

  return (
    <section className="support-page">
      <div className="support-container">
        <div className="support-header">
          <h1>Centre de support GoShopper</h1>
          <p>Trouvez des réponses complètes sur l'utilisation de GoShopper, les paiements mobile money, et toutes les fonctionnalités de votre assistant shopping IA.</p>
        </div>

        <div className="support-content">
          {/* Quick Stats */}
          <div className="support-stats">
            <div className="stat-item">
              <div className="stat-number">95%+</div>
              <div className="stat-label">Précision OCR</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">4</div>
              <div className="stat-label">Moyens de paiement mobile</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">24h</div>
              <div className="stat-label">Support client</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">30j</div>
              <div className="stat-label">Essai gratuit</div>
            </div>
          </div>

          {/* FAQ Section with Categories */}
          <div className="faq-section">
            <h2>Questions fréquemment posées</h2>
            
            {/* Category Tabs */}
            <div className="faq-categories">
              {Object.entries(faqCategories).map(([key, category]) => (
                <button
                  key={key}
                  className={`category-tab ${activeCategory === key ? 'active' : ''}`}
                  onClick={() => setActiveCategory(key)}
                >
                  {category.title}
                </button>
              ))}
            </div>

            {/* FAQ Items */}
            <div className="faq-items">
              {faqCategories[activeCategory].items.map((item) => (
                <div key={item.id} className="faq-item-expandable">
                  <button 
                    className="faq-question" 
                    onClick={() => toggleFAQ(item.id)}
                  >
                    <span>{item.question}</span>
                    <span className={`faq-toggle ${expandedFAQ === item.id ? 'open' : ''}`}>▼</span>
                  </button>
                  {expandedFAQ === item.id && (
                    <div className="faq-answer">
                      <p>{item.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Troubleshooting Guide */}
          <div className="troubleshooting-section">
            <h2>🔧 Guide de dépannage</h2>
            <div className="troubleshooting-grid">
              <div className="troubleshooting-item">
                <div className="trouble-icon">📱</div>
                <h3>Problèmes de scan</h3>
                <ul>
                  <li>Vérifiez l'éclairage (lumière naturelle idéale)</li>
                  <li>Étalez complètement le ticket</li>
                  <li>Tenez le téléphone stable à 20-30cm</li>
                  <li>Nettoyez l'objectif de votre appareil photo</li>
                </ul>
              </div>
              <div className="troubleshooting-item">
                <div className="trouble-icon">💳</div>
                <h3>Problèmes de paiement Mobile Money</h3>
                <ul>
                  <li>Vérifiez le solde de votre portefeuille mobile</li>
                  <li>Confirmez le numéro de téléphone (+243...)</li>
                  <li>Assurez-vous d'avoir une connexion stable</li>
                  <li>Vérifiez vos SMS pour les codes de confirmation</li>
                </ul>
              </div>
              <div className="troubleshooting-item">
                <div className="trouble-icon">🔄</div>
                <h3>Problèmes de synchronisation</h3>
                <ul>
                  <li>Vérifiez votre connexion Internet</li>
                  <li>Forcez la synchronisation dans Paramètres</li>
                  <li>Redémarrez l'application</li>
                  <li>Vérifiez l'espace de stockage disponible</li>
                </ul>
              </div>
              <div className="troubleshooting-item">
                <div className="trouble-icon">⚡</div>
                <h3>Performance lente</h3>
                <ul>
                  <li>Fermez les autres applications</li>
                  <li>Redémarrez votre téléphone</li>
                  <li>Vérifiez les mises à jour de l'app</li>
                  <li>Libérez de l'espace de stockage</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="payment-info-section">
            <h2>💰 Information sur les paiements</h2>
            <div className="payment-grid">
              <div className="payment-method-info">
                <h3>🇨🇩 Paiements en RDC</h3>
                <div className="mobile-money-options">
                  <div className="mm-option">
                    <img src="/m-pesa.png" alt="M-Pesa" className="mm-logo" />
                    <div>
                      <strong>M-Pesa</strong>
                      <p>Vodacom - Paiement instantané</p>
                    </div>
                  </div>
                  <div className="mm-option">
                    <img src="/orange-money.png" alt="Orange Money" className="mm-logo" />
                    <div>
                      <strong>Orange Money</strong>
                      <p>Orange - Confirmation par SMS</p>
                    </div>
                  </div>
                  <div className="mm-option">
                    <img src="/airtal-money.png" alt="Airtel Money" className="mm-logo" />
                    <div>
                      <strong>Airtel Money</strong>
                      <p>Airtel - Sécurisé par PIN</p>
                    </div>
                  </div>
                  <div className="mm-option">
                    <img src="/afrimoney.png" alt="AfriMoney" className="mm-logo" />
                    <div>
                      <strong>AfriMoney</strong>
                      <p>Tigo - Transaction rapide</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pricing-info">
                <h3>💲 Tarifs transparents</h3>
                <div className="pricing-table">
                  <div className="price-row">
                    <span>Basic (25 scans/mois)</span>
                    <span>1,99$ / 8 000 FC</span>
                  </div>
                  <div className="price-row">
                    <span>Standard (100 scans/mois)</span>
                    <span>2,99$ / 12 000 FC</span>
                  </div>
                  <div className="price-row premium">
                    <span>Premium (1,000 scans/mois)</span>
                    <span>4,99$ / 20 000 FC</span>
                  </div>
                </div>
                <p className="pricing-note">
                  ✅ Essai gratuit de 30 jours (10 scans)<br/>
                  ✅ Puis plan gratuit 3 scans/mois<br/>
                  ✅ Aucune carte requise<br/>
                  ✅ Annulation en un clic
                </p>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="contact-section">
            <h2>✉️ Contacter le support</h2>
            <p>Vous ne trouvez pas ce que vous cherchez ? Notre équipe vous répondra dans les 24 heures.</p>
            
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Nom complet</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Adresse e-mail</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="subject">Sujet</label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Sélectionnez un sujet</option>
                  <option value="technical">Problème technique</option>
                  <option value="billing">Question de facturation Mobile Money</option>
                  <option value="feature">Demande de fonctionnalité</option>
                  <option value="scan-issue">Problème de scan OCR</option>
                  <option value="data">Export de données</option>
                  <option value="account">Gestion de compte</option>
                  <option value="partnership">Partenariat magasin</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows="6"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Décrivez votre question en détail. Pour les problèmes techniques, précisez votre modèle de téléphone et version de l'app..."
                  required
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Envoi en cours...' : 'Envoyer le message'}
              </button>
              
              {submitStatus === 'success' && (
                <div className="form-success-message">
                  ✅ Merci pour votre message ! Nous vous répondrons dans les 24 heures.
                </div>
              )}
              
              {submitStatus === 'error' && (
                <div className="form-error-message">
                  ❌ Erreur lors de l'envoi. Veuillez réessayer ou nous contacter à support@goshopper.app
                </div>
              )}
            </form>
          </div>

          {/* Contact Methods */}
          <div className="contact-methods">
            <h2>📞 Autres moyens de nous joindre</h2>
            <div className="contact-grid">
              <div className="contact-method">
                <div className="contact-icon">📧</div>
                <h3>Support par e-mail</h3>
                <p>support@goshopper.app</p>
                <p>Réponse dans les 24 heures</p>
              </div>
              <div className="contact-method">
                <div className="contact-icon">💬</div>
                <h3>Chat en direct</h3>
                <p>Disponible dans l'application</p>
                <p>Lundi - Vendredi, 9h - 18h WAT</p>
              </div>
              <div className="contact-method">
                <div className="contact-icon">📚</div>
                <h3>Documentation</h3>
                <p>Guides complets et tutoriels</p>
                <p>Disponible 24/7</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Admin Panel for managing settings like exchange rate
function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [exchangeRate, setExchangeRate] = useState(2200);
  const [newRate, setNewRate] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [updateMessage, setUpdateMessage] = useState('');
  const [firebaseLoaded, setFirebaseLoaded] = useState(false);

  // Dynamically load Firebase
  useEffect(() => {
    const loadFirebase = async () => {
      try {
        // Check if Firebase is already loaded
        if (window.firebase) {
          setFirebaseLoaded(true);
          return;
        }

        // Load Firebase scripts dynamically
        const loadScript = (src) => {
          return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        };

        await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js');

        // Initialize Firebase
        if (!window.firebase.apps.length) {
          window.firebase.initializeApp(FIREBASE_CONFIG);
        }

        setFirebaseLoaded(true);
      } catch (error) {
        console.error('Error loading Firebase:', error);
        setLoginError('Erreur de chargement Firebase');
      }
    };

    loadFirebase();
  }, []);

  // Check auth state and load settings
  useEffect(() => {
    if (!firebaseLoaded) return;

    const unsubscribe = window.firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        // Check if user is admin (you can customize this check)
        const adminEmails = ['yannickmwamba3@gmail.com', 'admin@goshopper.app'];
        if (adminEmails.includes(user.email)) {
          setIsAuthenticated(true);
          loadSettings();
        } else {
          setLoginError('Accès non autorisé');
          await window.firebase.auth().signOut();
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseLoaded]);

  const loadSettings = async () => {
    try {
      const doc = await window.firebase.firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('public')
        .doc('data')
        .collection('settings')
        .doc('global')
        .get();

      if (doc.exists) {
        const data = doc.data();
        setExchangeRate(data.exchangeRates?.usdToCdf || 2200);
        setNewRate(String(data.exchangeRates?.usdToCdf || 2200));
        if (data.exchangeRates?.lastUpdated) {
          const date = data.exchangeRates.lastUpdated.toDate();
          setLastUpdated(date.toLocaleDateString('fr-FR') + ' à ' + date.toLocaleTimeString('fr-FR'));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    try {
      await window.firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Email ou mot de passe incorrect');
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await window.firebase.auth().signOut();
    setIsAuthenticated(false);
  };

  const handleUpdateRate = async (e) => {
    e.preventDefault();
    setUpdateMessage('');

    const rate = parseInt(newRate);
    if (isNaN(rate) || rate < 1000 || rate > 10000) {
      setUpdateMessage('Taux invalide (doit être entre 1000 et 10000)');
      return;
    }

    try {
      await window.firebase.firestore()
        .collection('artifacts')
        .doc(APP_ID)
        .collection('public')
        .doc('data')
        .collection('settings')
        .doc('global')
        .set({
          exchangeRates: {
            usdToCdf: rate,
            lastUpdated: window.firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: window.firebase.auth().currentUser?.email || 'admin'
          }
        }, { merge: true });

      setExchangeRate(rate);
      setUpdateMessage('✅ Taux mis à jour avec succès!');
      setLastUpdated(new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR'));
    } catch (error) {
      console.error('Error updating rate:', error);
      setUpdateMessage('❌ Erreur lors de la mise à jour');
    }
  };

  useEffect(() => {
    document.title = 'Admin - GoShopper';
  }, []);

  if (isLoading || !firebaseLoaded) {
    return (
      <section className="admin-section">
        <div className="admin-container">
          <div className="loading-spinner">Chargement...</div>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="admin-section">
        <div className="admin-container">
          <div className="admin-login-card">
            <h1>🔐 Admin GoShopper</h1>
            <p>Connectez-vous pour accéder au panneau d'administration</p>
            
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@goshopper.app"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Mot de passe</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {loginError && <div className="error-message">{loginError}</div>}
              <button type="submit" className="btn btn-primary">
                Se connecter
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-container">
        <div className="admin-header">
          <h1>⚙️ Panneau d'Administration</h1>
          <button onClick={handleLogout} className="btn btn-secondary">
            Déconnexion
          </button>
        </div>

        <div className="admin-cards">
          {/* Exchange Rate Card */}
          <div className="admin-card">
            <h2>💱 Taux de Change USD/CDF</h2>
            <div className="current-rate">
              <span className="rate-label">Taux actuel:</span>
              <span className="rate-value">1 USD = {exchangeRate.toLocaleString()} CDF</span>
            </div>
            {lastUpdated && (
              <p className="last-updated">Dernière mise à jour: {lastUpdated}</p>
            )}
            
            <form onSubmit={handleUpdateRate} className="update-form">
              <div className="form-group">
                <label htmlFor="newRate">Nouveau taux (CDF pour 1 USD)</label>
                <input
                  type="number"
                  id="newRate"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  placeholder="2200"
                  min="1000"
                  max="10000"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Mettre à jour
              </button>
              {updateMessage && (
                <div className={updateMessage.includes('✅') ? 'success-message' : 'error-message'}>
                  {updateMessage}
                </div>
              )}
            </form>
          </div>

          {/* Info Card */}
          <div className="admin-card info-card">
            <h2>ℹ️ Information</h2>
            <p>Le taux de change est utilisé pour:</p>
            <ul>
              <li>Conversion des prix sur les reçus</li>
              <li>Calcul du budget mensuel</li>
              <li>Affichage des statistiques</li>
            </ul>
            <p><strong>Note:</strong> Les changements sont appliqués en temps réel sur tous les appareils.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default App;