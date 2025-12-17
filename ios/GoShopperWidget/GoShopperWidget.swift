//
//  GoShopperWidget.swift
//  GoShopperWidget
//
//  GoShopper Home Screen Widget
//  Displays spending summary and quick actions
//

import WidgetKit
import SwiftUI

// MARK: - Widget Data Models

struct SpendingData: Codable {
    let monthlyTotal: Double
    let monthlyBudget: Double
    let currency: String
    let lastUpdated: String
    let percentUsed: Double
}

struct QuickStatsData: Codable {
    let totalReceipts: Int
    let totalSaved: Double
    let lastScanDate: String?
    let favoriteStore: String?
}

struct ShoppingListData: Codable {
    struct Item: Codable {
        let id: String
        let name: String
        let checked: Bool
    }
    let items: [Item]
    let totalItems: Int
    let checkedItems: Int
}

// MARK: - Timeline Provider

struct SpendingProvider: TimelineProvider {
    func placeholder(in context: Context) -> SpendingEntry {
        SpendingEntry(date: Date(), spending: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SpendingEntry) -> ()) {
        let entry = SpendingEntry(date: Date(), spending: loadSpendingData())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SpendingEntry>) -> ()) {
        let currentDate = Date()
        let spending = loadSpendingData()
        let entry = SpendingEntry(date: currentDate, spending: spending)
        
        // Refresh every 30 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
    
    private func loadSpendingData() -> SpendingData? {
        guard let userDefaults = UserDefaults(suiteName: "group.com.goshopper.widgets"),
              let jsonString = userDefaults.string(forKey: "widget_spending_data"),
              let data = jsonString.data(using: .utf8) else {
            return nil
        }
        
        return try? JSONDecoder().decode(SpendingData.self, from: data)
    }
}

struct SpendingEntry: TimelineEntry {
    let date: Date
    let spending: SpendingData?
}

// MARK: - Widget Views

struct SpendingWidgetView: View {
    var entry: SpendingProvider.Entry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        switch family {
        case .systemSmall:
            SmallSpendingView(spending: entry.spending)
        case .systemMedium:
            MediumSpendingView(spending: entry.spending)
        default:
            SmallSpendingView(spending: entry.spending)
        }
    }
}

struct SmallSpendingView: View {
    let spending: SpendingData?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Image(systemName: "cart.fill")
                    .foregroundColor(.red)
                Text("GoShopper")
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            
            Spacer()
            
            if let spending = spending {
                // Amount
                Text(formatCurrency(spending.monthlyTotal, currency: spending.currency))
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)
                
                // Progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 6)
                        
                        RoundedRectangle(cornerRadius: 4)
                            .fill(progressColor(spending.percentUsed))
                            .frame(width: geometry.size.width * min(spending.percentUsed / 100, 1.0), height: 6)
                    }
                }
                .frame(height: 6)
                
                Text("\(Int(spending.percentUsed))% du budget")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            } else {
                Text("Aucune donnée")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
    
    private func progressColor(_ percent: Double) -> Color {
        if percent < 50 {
            return .green
        } else if percent < 80 {
            return .orange
        } else {
            return .red
        }
    }
    
    private func formatCurrency(_ amount: Double, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }
}

struct MediumSpendingView: View {
    let spending: SpendingData?
    
    var body: some View {
        HStack(spacing: 16) {
            // Left side - Spending info
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "cart.fill")
                        .foregroundColor(.red)
                    Text("Dépenses du mois")
                        .font(.caption)
                        .fontWeight(.semibold)
                }
                
                if let spending = spending {
                    Text(formatCurrency(spending.monthlyTotal, currency: spending.currency))
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text("sur \(formatCurrency(spending.monthlyBudget, currency: spending.currency))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    // Progress
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.gray.opacity(0.2))
                                .frame(height: 8)
                            
                            RoundedRectangle(cornerRadius: 4)
                                .fill(progressColor(spending.percentUsed))
                                .frame(width: geometry.size.width * min(spending.percentUsed / 100, 1.0), height: 8)
                        }
                    }
                    .frame(height: 8)
                } else {
                    Text("Scannez une facture")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // Right side - Quick action
            VStack {
                Link(destination: URL(string: "goshopper://scan")!) {
                    VStack(spacing: 4) {
                        Image(systemName: "camera.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                        Text("Scanner")
                            .font(.caption2)
                            .foregroundColor(.white)
                    }
                    .frame(width: 70, height: 70)
                    .background(Color.red)
                    .cornerRadius(12)
                }
            }
        }
        .padding()
        .containerBackground(.fill.tertiary, for: .widget)
    }
    
    private func progressColor(_ percent: Double) -> Color {
        if percent < 50 { return .green }
        else if percent < 80 { return .orange }
        else { return .red }
    }
    
    private func formatCurrency(_ amount: Double, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
    }
}

// MARK: - Widget Configuration

@main
struct GoShopperWidget: Widget {
    let kind: String = "GoShopperWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SpendingProvider()) { entry in
            SpendingWidgetView(entry: entry)
        }
        .configurationDisplayName("GoShopper Dépenses")
        .description("Suivez vos dépenses mensuelles et scannez rapidement vos factures.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Preview

#Preview(as: .systemSmall) {
    GoShopperWidget()
} timeline: {
    SpendingEntry(date: .now, spending: SpendingData(
        monthlyTotal: 450.50,
        monthlyBudget: 800.00,
        currency: "EUR",
        lastUpdated: Date().ISO8601Format(),
        percentUsed: 56.3
    ))
}

#Preview(as: .systemMedium) {
    GoShopperWidget()
} timeline: {
    SpendingEntry(date: .now, spending: SpendingData(
        monthlyTotal: 650.00,
        monthlyBudget: 800.00,
        currency: "EUR",
        lastUpdated: Date().ISO8601Format(),
        percentUsed: 81.25
    ))
}
