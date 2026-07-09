import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "服务条款 · 人生树" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/"
        className="text-sm text-[var(--fg-dim)] transition hover:text-[var(--accent)]"
      >
        ← 返回首页
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--fg)]">
        服务条款
      </h1>
      <p className="mt-1 text-sm text-[var(--fg-faint)]">更新日期：2026-07-03</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-[var(--fg-dim)]">
        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            1. 服务性质
          </h2>
          <p>
            「人生树」提供的是基于人工智能生成的「可能性推演」——一种帮助你思考不同人生选择的参考视角，而非预测、占卜或专业建议（不构成医疗、法律或投资建议）。你依据这些内容做出的任何决策，风险由你自行承担。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            2. 订阅
          </h2>
          <p>
            Pro
            为自动续订订阅，提供年度（含
            7 天免费试用）与月度两种周期，费用通过你的 Apple
            账户扣款。订阅将在当前周期到期前
            24 小时内自动续订，你可以随时在系统「设置 →
            订阅」中查看或取消。退款依据 Apple
            的官方政策处理，请通过 Apple
            提交退款申请，我们无法直接为你办理退款。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            3. 免费使用
          </h2>
          <p>
            不订阅 Pro
            也可以持续使用应用的核心功能，AI 相关额度会按月重置。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            4. 合理使用
          </h2>
          <p>
            请勿滥用、逆向工程、批量抓取或以任何方式干扰本服务的正常运行。对于违反本条款的行为，我们保留暂停或终止服务的权利。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            5. 内容与安全
          </h2>
          <p>
            如果应用检测到你输入的内容涉及自我伤害等危机信号，会主动展示求助资源。如遇紧急情况，请立即联系当地急救或危机干预服务，不要仅依赖本应用。
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            6. 条款变更与联系方式
          </h2>
          <p>
            我们可能会不定期更新本条款，重大变更会在应用内提示。如有疑问，请发送邮件至{" "}
            <a
              href="mailto:ruizheyuan3487@gmail.com"
              className="text-[var(--accent)] underline underline-offset-2"
            >
              ruizheyuan3487@gmail.com
            </a>
            。本条款更新日期：2026-07-03。
          </p>
        </section>

        <section className="border-t border-[var(--line)] pt-6">
          <h2 className="mb-2 text-base font-semibold text-[var(--fg)]">
            English summary
          </h2>
          <p className="text-sm">
            Life Planner (人生树) generates AI-based &quot;possibility
            projections&quot; for reflection — not predictions, fortune
            telling, or professional (medical, legal, financial) advice; you
            act on them at your own risk. Pro is an auto-renewable
            subscription (annual with a 7-day free trial, or monthly),
            charged via your Apple account and renewed within 24 hours before
            the end of each period unless cancelled in Settings &gt;
            Subscriptions; refunds follow Apple&apos;s policy and must be
            requested through Apple. Core features remain usable without a
            subscription, with AI usage limits resetting monthly. Abuse,
            reverse engineering, or bulk scraping may result in service
            suspension. Crisis-related input triggers in-app help resources;
            in an emergency, contact local emergency services directly.
          </p>
        </section>
      </div>
    </main>
  );
}
