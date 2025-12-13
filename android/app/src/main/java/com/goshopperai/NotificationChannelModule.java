package com.goshopperai;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class NotificationChannelModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "NotificationChannelModule";

    public NotificationChannelModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void createNotificationChannels(Promise promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager notificationManager =
                        (NotificationManager) getReactApplicationContext()
                                .getSystemService(Context.NOTIFICATION_SERVICE);

                if (notificationManager == null) {
                    promise.reject("ERROR", "NotificationManager is null");
                    return;
                }

                // Price Alerts Channel
                NotificationChannel priceAlertsChannel = new NotificationChannel(
                        "price_alerts",
                        "Alertes Prix",
                        NotificationManager.IMPORTANCE_HIGH
                );
                priceAlertsChannel.setDescription("Notifications lorsque les prix baissent");
                priceAlertsChannel.enableVibration(true);
                priceAlertsChannel.enableLights(true);
                notificationManager.createNotificationChannel(priceAlertsChannel);

                // Savings Tips Channel
                NotificationChannel savingsTipsChannel = new NotificationChannel(
                        "savings_tips",
                        "Conseils d'Économie",
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                savingsTipsChannel.setDescription("Conseils hebdomadaires pour économiser");
                notificationManager.createNotificationChannel(savingsTipsChannel);

                // Achievements Channel
                NotificationChannel achievementsChannel = new NotificationChannel(
                        "achievements",
                        "Achievements",
                        NotificationManager.IMPORTANCE_HIGH
                );
                achievementsChannel.setDescription("Déblocage de nouveaux achievements");
                achievementsChannel.enableVibration(true);
                achievementsChannel.enableLights(true);
                notificationManager.createNotificationChannel(achievementsChannel);

                // Sync Notifications Channel
                NotificationChannel syncChannel = new NotificationChannel(
                        "sync_notifications",
                        "Synchronisation",
                        NotificationManager.IMPORTANCE_LOW
                );
                syncChannel.setDescription("État de synchronisation des factures");
                notificationManager.createNotificationChannel(syncChannel);

                // Subscription Alerts Channel
                NotificationChannel subscriptionChannel = new NotificationChannel(
                        "subscription_alerts",
                        "Alertes Abonnement",
                        NotificationManager.IMPORTANCE_HIGH
                );
                subscriptionChannel.setDescription("Rappels d'expiration d'abonnement");
                subscriptionChannel.enableVibration(true);
                notificationManager.createNotificationChannel(subscriptionChannel);

                // Admin Broadcast Channel
                NotificationChannel adminChannel = new NotificationChannel(
                        "admin_broadcast",
                        "Annonces",
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                adminChannel.setDescription("Annonces importantes de l'équipe GoShopperAI");
                notificationManager.createNotificationChannel(adminChannel);

                // General Notifications Channel (fallback)
                NotificationChannel generalChannel = new NotificationChannel(
                        "general",
                        "Notifications Générales",
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                generalChannel.setDescription("Autres notifications");
                notificationManager.createNotificationChannel(generalChannel);

                promise.resolve("Channels created successfully");
            } catch (Exception e) {
                promise.reject("ERROR", "Failed to create notification channels: " + e.getMessage());
            }
        } else {
            promise.resolve("Channels not needed for API < 26");
        }
    }
}
