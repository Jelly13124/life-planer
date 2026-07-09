// 人生树 iOS 主屏小组件（WidgetKit + SwiftUI，仅标准库）。
// 数据来源：RN 侧 mobile/src/lib/widgetSnapshot.ts 经 App Group UserDefaults
// 写入的 JSON 快照（key = "widgetSnapshot"）；本文件只读不写。
import WidgetKit
import SwiftUI

private let appGroup = "group.com.jelly13124.lifeplanner"
private let snapshotKey = "widgetSnapshot"

// 与 RN 侧快照结构一一对应（widgetSnapshot.ts 的 WidgetSnapshot）。
struct WidgetSnapshot: Decodable {
  var streak: Int
  var todayCount: Int
  var chosenLabel: String?
  var chosenFeasibility: Int?
  var updatedAt: String
}

func loadSnapshot() -> WidgetSnapshot? {
  guard
    let defaults = UserDefaults(suiteName: appGroup),
    let json = defaults.string(forKey: snapshotKey),
    let data = json.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
}

struct SnapshotEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
}

struct SnapshotProvider: TimelineProvider {
  // 小组件库/加载态的样例数据：连续 7 天、今日 3 个任务。
  func placeholder(in context: Context) -> SnapshotEntry {
    SnapshotEntry(
      date: Date(),
      snapshot: WidgetSnapshot(
        streak: 7,
        todayCount: 3,
        chosenLabel: nil,
        chosenFeasibility: nil,
        updatedAt: ""
      )
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
    if context.isPreview {
      completion(placeholder(in: context))
    } else {
      completion(SnapshotEntry(date: Date(), snapshot: loadSnapshot()))
    }
  }

  // 单条目时间线 + 下个整点后刷新（app 内每次数据变更还会主动 reloadWidget）。
  func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
    let now = Date()
    let entry = SnapshotEntry(date: now, snapshot: loadSnapshot())
    let nextHour =
      Calendar.current.nextDate(
        after: now,
        matching: DateComponents(minute: 0),
        matchingPolicy: .nextTime
      ) ?? now.addingTimeInterval(3600)
    completion(Timeline(entries: [entry], policy: .after(nextHour)))
  }
}

// 主题：白底、近黑文字、品牌紫罗兰（同 app 的 Apple 风白色极简主题）。
private let violet = Color(red: 0.42, green: 0.16, blue: 0.85)
private let ink = Color(red: 0.10, green: 0.10, blue: 0.12)

// 左列（= 小尺寸全部内容）：火焰 + 连击天数 + 今日任务数。
struct StreakColumn: View {
  let snapshot: WidgetSnapshot?

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Image(systemName: "flame.fill")
        .font(.title2)
        .foregroundStyle(.orange)
      Text("连续 \(snapshot?.streak ?? 0) 天")
        .font(.headline)
        .bold()
        .foregroundStyle(ink)
      Text("今日 \(snapshot?.todayCount ?? 0) 个任务")
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
  }
}

// 右列（仅中尺寸）：已选路线 + 可行度进度条 + 「约 N%」。
struct ChosenPathColumn: View {
  let snapshot: WidgetSnapshot?

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      if let label = snapshot?.chosenLabel, !label.isEmpty {
        Text(label)
          .font(.subheadline)
          .bold()
          .foregroundStyle(ink)
          .lineLimit(2)
        let feasibility = min(100, max(0, snapshot?.chosenFeasibility ?? 0))
        ProgressView(value: Double(feasibility), total: 100)
          .tint(violet)
        Text("约 \(feasibility)%")
          .font(.caption)
          .foregroundStyle(.secondary)
      } else {
        Text("还没选定路线")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    }
  }
}

struct LifePlannerWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: SnapshotEntry

  var body: some View {
    Group {
      if family == .systemMedium {
        HStack(alignment: .center, spacing: 16) {
          StreakColumn(snapshot: entry.snapshot)
            .frame(maxWidth: .infinity, alignment: .leading)
          ChosenPathColumn(snapshot: entry.snapshot)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      } else {
        StreakColumn(snapshot: entry.snapshot)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      }
    }
    .widgetURL(URL(string: "lifeplanner://"))
    .containerBackground(for: .widget) { Color.white }
  }
}

struct LifePlannerWidget: Widget {
  let kind: String = "LifePlannerWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SnapshotProvider()) { entry in
      LifePlannerWidgetView(entry: entry)
    }
    .configurationDisplayName("人生树")
    .description("连击天数、今日任务与已选路线的可行度。")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct LifePlannerWidgets: WidgetBundle {
  var body: some Widget {
    LifePlannerWidget()
  }
}
