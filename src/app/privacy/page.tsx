import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "隐私政策 · 人生树" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/"
        className="text-sm text-[var(--fg-dim)] transition hover:text-[var(--accent)]"
      >
        ← 返回首页
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--fg)]">
        隐私政策
      </h1>
      <p className="mt-1 text-sm text-[var(--fg-faint)]">更新日期：2026-07-03</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-[var(--fg-dim)]">
        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            1. 我们收集什么
          </h2>
          <p>
            为了让「人生树」为你生成有意义的推演与建议，我们会收集你在引导流程或使用中主动填写的个人资料——例如昵称、年龄、职业、财务区间等——以及你在应用内创建的目标、任务、习惯与预测数据。这些信息只用于支撑你自己的规划体验。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            2. 存储在哪
          </h2>
          <p>
            默认情况下，你的数据只保存在你自己的设备本地，不上传任何服务器。当你选择登录并开启云同步后，数据会通过加密连接传输，存储在
            Supabase 数据库中，并启用行级安全（RLS）策略——只有你自己的账号能够读写属于你的数据。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            3. AI 处理
          </h2>
          <p>
            预测、拆解与建议类内容由我们的服务端调用大语言模型生成。你的资料摘要仅用于当次生成对应内容，不会被用于模型训练，也不会出售给任何第三方。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            4. 分享卡
          </h2>
          <p>
            只有当你主动点击「分享」时，我们才会生成一张脱敏后的分享卡片（仅包含标题、昵称、百分比、寄语等你选择公开的内容），并生成一个可公开访问的链接。未经你主动操作，任何数据都不会被公开。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            5. 数据删除
          </h2>
          <p>
            你可以随时在应用内使用「重置数据」功能，清除本地与云端保存的全部数据；也可以通过邮件联系我们，请求删除你的账号及关联数据。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            6. 推送通知
          </h2>
          <p>
            本地通知仅在你主动开启提醒时由你的设备本地调度触发，不经过我们的服务器，也不会被用于追踪。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            7. 联系我们
          </h2>
          <p>
            如对本政策有任何疑问，或希望删除账号与数据，请发送邮件至{" "}
            <a
              href="mailto:ruizheyuan3487@gmail.com"
              className="text-[var(--accent)] underline underline-offset-2"
            >
              ruizheyuan3487@gmail.com
            </a>
            。本政策更新日期：2026-07-03。
          </p>
        </section>

        <section className="border-t border-[var(--line)] pt-6">
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            English summary
          </h2>
          <p className="text-sm">
            Life Planner (人生树) stores your profile and planning data locally
            on your device by default. If you sign in and enable cloud sync,
            data is encrypted in transit and stored in Supabase, protected by
            row-level security so only your account can access it. AI
            predictions are generated server-side from a summary of your data,
            never used for model training, and never sold. Share cards are
            only created and made public when you explicitly tap Share. You
            can delete all local and cloud data anytime via in-app Reset Data,
            or by emailing ruizheyuan3487@gmail.com. Local notifications, when
            enabled, are scheduled entirely on-device.
          </p>
        </section>
      </div>
    </main>
  );
}
