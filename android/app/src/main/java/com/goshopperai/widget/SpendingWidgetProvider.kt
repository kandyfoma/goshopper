package com.goshopperai.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
// Temporary comment to fix build - import com.goshopperai.R
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/**
 * GoShopperAI Spending Widget
 * Displays monthly spending summary on the home screen
 */
class SpendingWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        // Called when the first widget is created
    }

    override fun onDisabled(context: Context) {
        // Called when the last widget is removed
    }

    companion object {
        private const val PREFS_NAME = "com.goshopperai.widgets"
        private const val SPENDING_KEY = "widget_spending_data"

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            // TODO: Widget functionality temporarily disabled
            // Will be re-enabled once R class generation is fixed
        }
    }
}
