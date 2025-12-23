// Share Service
// Enables sharing receipts, comparisons, and shopping lists

import Share, {ShareOptions} from 'react-native-share';
import {Platform} from 'react-native';
import {Receipt} from '@/shared/types';

export interface ShareContent {
  title?: string;
  message: string;
  url?: string;
  type?: string;
}

export const shareService = {
  /**
   * Share a simple text message
   */
  async shareText(message: string, title?: string): Promise<boolean> {
    try {
      const options: ShareOptions = {
        title: title || 'Partager',
        message,
        failOnCancel: false,
      };

      const result = await Share.open(options);
      return !!result.success;
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('Error sharing text:', error);
      }
      return false;
    }
  },

  /**
   * Share a URL with a message
   */
  async shareUrl(url: string, message?: string, title?: string): Promise<boolean> {
    try {
      const options: ShareOptions = {
        title: title || 'Partager',
        message: message || '',
        url,
        failOnCancel: false,
      };

      const result = await Share.open(options);
      return !!result.success;
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('Error sharing URL:', error);
      }
      return false;
    }
  },

  /**
   * Share a receipt summary
   */
  async shareReceipt(receipt: Receipt): Promise<boolean> {
    try {
      const storeName = receipt.storeName || 'Magasin inconnu';
      const date = receipt.scannedAt 
        ? new Date(receipt.scannedAt).toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric' 
          })
        : 'Date inconnue';
      
      // Format both currencies if available
      const primaryTotal = receipt.currency === 'USD'
        ? `$${receipt.total.toFixed(2)}`
        : `${receipt.total.toLocaleString('fr-FR')} CDF`;
      
      const secondaryTotal = receipt.currency === 'USD' && receipt.totalCDF
        ? ` (≈ ${receipt.totalCDF.toLocaleString('fr-FR')} CDF)`
        : receipt.currency === 'CDF' && receipt.totalUSD
          ? ` (≈ $${receipt.totalUSD.toFixed(2)})`
          : '';
      
      const itemCount = receipt.items?.length || 0;
      const city = receipt.city ? `\n📍 ${receipt.city}` : '';

      // Format top items with better currency display
      const itemsList = receipt.items?.slice(0, 5).map(item => {
        const price = item.unitPrice 
          ? receipt.currency === 'USD'
            ? `$${item.unitPrice.toFixed(2)}`
            : `${item.unitPrice.toLocaleString('fr-FR')} CDF`
          : '-';
        const qty = item.quantity > 1 ? `${item.quantity}x ` : '';
        return `  • ${qty}${item.name} - ${price}`;
      }).join('\n') || '';

      const message = `━━━━━━━━━━━━━━━━━━━━
🧾 REÇU DE CAISSE
━━━━━━━━━━━━━━━━━━━━\n
🏪 ${storeName}${city}
📅 ${date}

💳 TOTAL: ${primaryTotal}${secondaryTotal}
📦 ${itemCount} article${itemCount > 1 ? 's' : ''}\n
${itemsList ? '━━━ ARTICLES ━━━\n' + itemsList : ''}${itemCount > 5 ? `\n  ... et ${itemCount - 5} autre${itemCount - 5 > 1 ? 's' : ''}` : ''}\n
━━━━━━━━━━━━━━━━━━━━
📱 Analysé avec GoShopperAI\n💡 Gérez vos dépenses intelligemment`;

      return await this.shareText(message, `Reçu - ${storeName}`);
    } catch (error) {
      console.error('Error sharing receipt:', error);
      return false;
    }
  },

  /**
   * Share price comparison results
   */
  async sharePriceComparison(
    itemName: string,
    prices: Array<{storeName: string; price: number; currency: string}>,
  ): Promise<boolean> {
    try {
      const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
      const bestPrice = sortedPrices[0];
      const savings = sortedPrices.length > 1 
        ? sortedPrices[sortedPrices.length - 1].price - bestPrice.price
        : 0;

      const message = `💰 Comparaison de prix - GoShopper

🔍 Article: ${itemName}

📊 Prix par magasin:
${sortedPrices.map((p, i) => 
  `${i === 0 ? '⭐ ' : '   '}${p.storeName}: ${p.currency === 'USD' ? '$' : ''}${p.price.toFixed(2)} ${p.currency === 'CDF' ? 'CDF' : ''}`
).join('\n')}

${savings > 0 ? `💸 Économie possible: $${savings.toFixed(2)}` : ''}

Trouvé avec GoShopper 📱`;

      return await this.shareText(message, `Prix - ${itemName}`);
    } catch (error) {
      console.error('Error sharing price comparison:', error);
      return false;
    }
  },

  /**
   * Share a shopping list
   */
  async shareShoppingList(
    items: Array<{name: string; quantity?: number; checked?: boolean}>,
    listName?: string,
  ): Promise<boolean> {
    try {
      const uncheckedItems = items.filter(item => !item.checked);
      const checkedItems = items.filter(item => item.checked);

      let message = `📋 Liste de courses${listName ? ` - ${listName}` : ''}\n\n`;

      if (uncheckedItems.length > 0) {
        message += `À acheter:\n`;
        message += uncheckedItems.map(item => 
          `☐ ${item.name}${item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}`
        ).join('\n');
      }

      if (checkedItems.length > 0) {
        message += `\n\n✅ Déjà pris:\n`;
        message += checkedItems.map(item => 
          `☑ ${item.name}${item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}`
        ).join('\n');
      }

      message += `\n\nCréée avec GoShopper 📱`;

      return await this.shareText(message, listName || 'Ma liste de courses');
    } catch (error) {
      console.error('Error sharing shopping list:', error);
      return false;
    }
  },

  /**
   * Share savings summary
   */
  async shareSavingsSummary(
    totalSaved: number,
    currency: string,
    period: string,
    scansCount: number,
  ): Promise<boolean> {
    try {
      const currencySymbol = currency === 'USD' ? '$' : '';
      const currencySuffix = currency === 'CDF' ? ' CDF' : '';

      const message = `🎉 Mes économies avec GoShopperAI!

💰 ${currencySymbol}${totalSaved.toFixed(2)}${currencySuffix} économisés
📅 ${period}
🧾 ${scansCount} ticket${scansCount > 1 ? 's' : ''} analysé${scansCount > 1 ? 's' : ''}

Comparez vos prix et économisez avec GoShopperAI! 📱`;

      return await this.shareText(message, 'Mes économies');
    } catch (error) {
      console.error('Error sharing savings:', error);
      return false;
    }
  },

  /**
   * Share app with a friend
   */
  async shareApp(): Promise<boolean> {
    try {
      const message = `🛒 Découvre GoShopperAI!

📸 Scanne tes tickets de caisse
💰 Compare les prix entre magasins
📊 Suis tes dépenses
🎯 Économise sur tes achats

Télécharge l'app maintenant! 📱`;

      // TODO: Add actual app store links when published
      const appStoreUrl = Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/goshopperai'
        : 'https://play.google.com/store/apps/details?id=com.goshopperai';

      return await this.shareUrl(appStoreUrl, message, 'GoShopperAI');
    } catch (error) {
      console.error('Error sharing app:', error);
      return false;
    }
  },
};

export default shareService;
