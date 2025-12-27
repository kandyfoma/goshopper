# GoShopper Subscription Plans - Updated

## Current Plan Structure (December 26, 2025)

### 1. **Plan Gratuit (Freemium)**
- **Price**: Free
- **Scans**: 3/month
- **Features**:
  - 3 scans par mois
  - Reconnaissance IA basique
  - Historique 7 jours
  - 1 liste de courses

### 2. **Essai Gratuit (Free Trial)**
- **Price**: Free
- **Duration**: 30 days
- **Scans**: 10 during trial
- **Features**:
  - 1 mois gratuit
  - 10 scans pendant l'essai
  - Toutes les fonctionnalités premium

### 3. **Plan Basic**
- **Price**: $1.99/month or 8,000 FC
- **Scans**: 25/month
- **Features**:
  - 25 scans par mois
  - Listes de courses
  - Historique 30 jours
  - Localisation française

### 4. **Plan Standard**
- **Price**: $2.99/month or 12,000 FC
- **Scans**: 100/month
- **Features**:
  - 100 scans par mois
  - Comparaison de prix
  - Historique 2 mois
  - Rapports de dépenses
  - Historique des prix
  - Analyse par catégorie
  - Mode hors ligne

### 5. **Plan Premium**
- **Price**: $4.99/month or 20,000 FC
- **Scans**: **1,000/month** (NOT unlimited)
- **Features**:
  - **1,000 scans par mois**
  - Statistiques avancées
  - Comparaison de prix
  - Historique illimité
  - Rapports de dépenses
  - Historique des prix
  - Analyse par catégorie
  - Mode hors ligne
  - Alertes de prix
  - Listes de courses illimitées
  - Export des données

## Scan Pack Add-ons

Users can purchase additional scans à la carte:

- **Petit Pack**: 5 scans - $0.49 (2,000 FC)
- **Pack Moyen**: 10 scans - $0.99 (4,000 FC) ⭐ Popular
- **Grand Pack**: 25 scans - $1.99 (8,000 FC)

## Emergency Scans

When users run out of monthly scans, they get **3 free emergency scans** as a one-time buffer before requiring upgrade/purchase.

## Payment Methods

### 🇨🇩 Congo (DRC)
- M-Pesa (Vodacom)
- Orange Money
- Airtel Money
- AfriMoney (Tigo)
- Visa Cards

### 🌍 International
- Visa/Mastercard (via Stripe)

## Key Changes Made (December 26, 2025)

1. ✅ **Premium is NO LONGER UNLIMITED**
   - Changed from `-1` (unlimited) to `1000` scans/month
   - Updated `PLAN_SCAN_LIMITS.premium` from `-1` to `1000`
   - Updated `SUBSCRIPTION_PLANS.premium.scanLimit` from `-1` to `1000`

2. ✅ **Updated App Displays**
   - Removed `∞` (infinity) symbols for Premium
   - Now shows actual scan count: `1000`, `999`, etc.
   - Fixed SubscriptionScreen, ScanPacksScreen, SubscriptionDetailsScreen

3. ✅ **Updated Website Information**
   - Changed "Premium (Illimité)" to "Premium (1,000 scans/mois)"
   - Updated FAQ with correct pricing and limits
   - Clarified that Premium is NOT unlimited

4. ✅ **Fixed Premium Price**
   - Corrected from $1.00/4,000 FC to **$4.99/20,000 FC**

## Feature Access by Plan

| Feature | Freemium | Trial | Basic | Standard | Premium |
|---------|----------|-------|-------|----------|---------|
| Scans/month | 3 | 10 | 25 | 100 | **1,000** |
| Basic Scanning | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shopping Lists | 1 | ✅ | ✅ | ✅ | Unlimited |
| Price Comparison | ❌ | ✅ | ❌ | ✅ | ✅ |
| Statistics | ❌ | ❌ | ❌ | ❌ | ✅ |
| Price Alerts | ❌ | ❌ | ❌ | ❌ | ✅ |
| Data Export | ❌ | ❌ | ❌ | ❌ | ✅ |
| Offline Mode | ❌ | ❌ | ❌ | ✅ | ✅ |

## Files Updated

### App (React Native)
- ✅ `src/shared/utils/constants.ts` - Fixed PLAN_SCAN_LIMITS and SUBSCRIPTION_PLANS
- ✅ `src/features/subscription/screens/SubscriptionScreen.tsx` - Removed "Illimité" display
- ✅ `src/features/subscription/screens/ScanPacksScreen.tsx` - Removed ∞ symbol
- ✅ `src/features/subscription/screens/SubscriptionDetailsScreen.tsx` - Removed ∞ symbol

### Website
- ✅ `web/src/App.js` - Updated pricing display to show "1,000 scans/mois" instead of "Illimité"
- ✅ `web/src/App.js` - Updated FAQ with correct plan details

## Migration Notes

### For Existing Premium Users
- Existing Premium subscribers are **grandfathered** with their current plan
- No immediate action needed
- Scan limits will apply at next renewal cycle
- Communication should be sent before enforcement

### Backend Considerations
- Firebase functions already handle scan limits correctly
- `canUserScan()` function respects `PLAN_SCAN_LIMITS`
- Emergency scans (3 free) kick in when monthly limit reached
- Bonus scans from purchases work independently of monthly limits
