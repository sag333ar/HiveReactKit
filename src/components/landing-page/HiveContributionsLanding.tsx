import React from "react";
import AppsGrid from "./AppsGrid";
import { apps } from "../../data/appsData";
import { ECENCY_IMAGES } from "../../data/ecencyImageUrls";
import {
  Eye,
  Crosshair,
  Star,
  Zap,
  Code2,
  Rocket,
  Users,
  Clock,
  Calendar,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

interface SupporterItem {
  title: string;
  description: string;
  avatar: string;
  link: string;
  buttonText: string;
}

const DEFAULT_SUPPORTERS: SupporterItem[] = [
  {
    title: "Powered by Hive.io",
    description: "Explore the Hive blockchain",
    avatar: "https://images.hive.blog/u/hiveio/avatar",
    link: "https://hive.io/",
    buttonText: "Visit",
  },
  {
    title: "Cheered by @starkerz",
    description: "Community supporter",
    avatar: "https://images.ecency.com/webp/u/starkerz/avatar/medium",
    link: "https://peakd.com/@starkerz",
    buttonText: "View",
  },
  {
    title: "Encouraged by @theycallmedan",
    description: "Hive advocate & supporter",
    avatar: "https://images.ecency.com/webp/u/theycallmedan/avatar/medium",
    link: "https://peakd.com/@theycallmedan",
    buttonText: "View",
  },
  {
    title: "Github",
    description: "It's all open source",
    avatar: "https://avatars.githubusercontent.com/u/259840578?s=200&v=4",
    link: "https://github.com/orgs/TechCoderLabz/repositories",
    buttonText: "View",
  },
];

const BELIEFS = [
  { icon: Zap, title: "Simplicity Wins", desc: "Blockchain technology should feel as easy as using any modern mobile app." },
  { icon: Code2, title: "Open Ecosystem", desc: "All our apps are open source so developers can learn, extend, and build." },
  { icon: Rocket, title: "Build First, Talk Later", desc: "We prefer shipping real products and improving with community feedback." },
  { icon: Users, title: "Community Over Ownership", desc: "These are tools built for the entire Hive ecosystem, not closed platforms." },
];

const DELIVERED_APPS = [
  { name: "Distriator", logo: ECENCY_IMAGES.distriator_logo },
  { name: "CheckInWithXYZ", logo: ECENCY_IMAGES.checkinwithxyz },
  { name: "hReplier", logo: ECENCY_IMAGES.hreplier },
  { name: "hStats", logo: ECENCY_IMAGES.stats_logo },
  { name: "hPolls", logo: ECENCY_IMAGES.hpolls_logo },
  { name: "hFestFacts", logo: ECENCY_IMAGES.hive_fest_fact_logo },
  { name: "hSnaps", logo: ECENCY_IMAGES.template },
  { name: "hCurators",logo: ECENCY_IMAGES.vote_logo },
];

const IN_DEV_APPS = [
  {
    name: "hApprover",
    desc: "Approve Hive transactions from your phone",
    logo: ECENCY_IMAGES.happrover_logo,
  },
  {
    name: "hSurvey",
    desc: "Create and participate in surveys on Hive",
    logo: ECENCY_IMAGES.hsurvey_logo,
  }

];

const PLANNED_APPS = [
  "hChat",
  "hShorts",
  "hVideos",
  "hGovernance",
  "hFind",
  "hMarketPlace",
];

interface HiveContributionsLandingProps {
  backgroundColor?: string;
  textColor?: string;
  cardBackgroundColor?: string;
  isDividerShow?: boolean;
  dividerColor?: string;
  isExpensesCTA?: boolean;
  onViewExpenses?: () => void;
  extraSupporters?: SupporterItem[];
}

const LIGHTEST_RED = "#f87171";

const HiveContributionsLanding: React.FC<HiveContributionsLandingProps> = ({
  backgroundColor = "#020617",
  textColor = "#e5e7eb",
  cardBackgroundColor = "rgba(15,23,42,0.85)",
  isDividerShow = true,
  dividerColor = "rgba(148,163,184,0.4)",
  isExpensesCTA = false,
  onViewExpenses,
  extraSupporters = []
}) => {
  const supporters = [...DEFAULT_SUPPORTERS, ...extraSupporters];
  const cardShadow = "0 18px 45px rgba(0,0,0,0.6)";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundColor,
        }}
      />

      {/* Blur Overlay */}
      <div
        className="fixed inset-0 z-10 backdrop-blur-md"
        style={{ backgroundColor: "rgba(15,23,42,0.6)" }}
      />

      {/* Gradient Overlays */}
      <div className="fixed inset-0 z-20 bg-gradient-to-br from-base-100 via-transparent to-base-100/10" />
      <div className="fixed inset-0 z-20 bg-gradient-to-b from-base-100 via-transparent to-base-100/10" />

      {/* Content */}
      <div className="relative z-30" style={{ color: textColor }}>
        <main className="min-h-screen">
          <>
          {/* Divider */}
          {isDividerShow && (
            <div className="py-8">
              <div
                style={{
                  height: 1,
                  width: "100%",
                  maxWidth: "72rem",
                  margin: "0 auto",
                  backgroundColor: dividerColor,
                  opacity: 0.8,
                }}
              />
            </div>
          )}

          {/* Vision & Mission */}
          <section className="py-12">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                Our Vision &amp; Mission
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {/* Vision */}
                <div
                  className="card glass-effect hover-lift p-6 rounded-xl"
                  style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                      <Eye className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-base-content">Vision</h3>
                  </div>
                  <p className="text-base-content font-semibold mb-2">
                    Make Hive accessible to the world through simple, powerful
                    applications.
                  </p>
                  <p className="text-base-content/70">
                    We aim to bridge the gap between traditional social apps and
                    decentralized technologies by creating familiar,
                    easy-to-use products.
                  </p>
                </div>
                {/* Mission */}
                <div
                  className="card glass-effect hover-lift p-6 rounded-xl"
                  style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                      <Crosshair className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-base-content">Mission</h3>
                  </div>
                  <p className="text-base-content font-semibold mb-2">
                    Build open, user-friendly applications that help Hive reach
                    Web2 audiences.
                  </p>
                  <p className="text-base-content/70">
                    Everything we build is open source and community driven.
                  </p>
                </div>
              </div>
              {/* Goal */}
              <div className="max-w-4xl mx-auto mt-6">
                <div className="card glass-effect hover-lift p-6 rounded-xl" style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                      <Star className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-base-content">Goal</h3>
                  </div>
                  <p className="text-base-content font-semibold mb-2">
                    Help Hive grow by making it easier for Web2 users to
                    discover and use.
                  </p>
                  <p className="text-base-content/70">
                    Built without external funding, with passion for Hive, for
                    the entire community, and completely open source.
                  </p>
                </div>
              </div>

              {/* Expenses CTA */}
              {isExpensesCTA && (
                <div className="max-w-4xl mx-auto mt-6">
                <button
                  type="button"
                  onClick={onViewExpenses}
                  className="w-full text-left"
                >
                  <div
                    className="card glass-effect hover-lift p-6 rounded-xl border-2 transition-colors"
                    style={{
                      backgroundColor: cardBackgroundColor,
                      borderColor: dividerColor,
                      boxShadow: cardShadow,
                    }}
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: dividerColor }}
                      >
                        <span className="text-xl font-bold" style={{ color: LIGHTEST_RED }}>
                          ₹
                        </span>
                      </div>
                      <div className="text-center sm:text-left flex-1">
                        <h3 className="text-xl font-bold" style={{ color: LIGHTEST_RED }}>
                          Running in Heavy Debt — See Our Expenses
                        </h3>
                        <p className="text-sm mt-1" style={{ color: textColor }}>
                          We have spent our own money with zero revenue. No funding,
                          no ads, no monetization. Open this transparent breakdown
                          to understand how much it really costs.
                        </p>
                      </div>
                      <span
                        className="btn btn-outline btn-sm shrink-0"
                        style={{
                          color: LIGHTEST_RED,
                          borderColor: LIGHTEST_RED,
                          backgroundColor: "rgba(233, 57, 57, 0.26)",
                        }}
                      >
                        View Expenses →
                      </span>
                    </div>
                  </div>
                </button>
                </div>
              )}
            </div>
          </section>

          {/* Divider */}
          {isDividerShow && (
            <div className="py-4">
              <div
                style={{
                  height: 1,
                  width: "100%",
                  maxWidth: "72rem",
                  margin: "0 auto",
                  backgroundColor: dividerColor,
                  opacity: 0.8,
                }}
              />
            </div>
          )}

          {/* What We Believe */}
          <section className="py-12">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                What We Believe
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {BELIEFS.map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="card glass-effect hover-lift p-6 rounded-xl text-center"
                    style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                  >
                    <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-4 text-primary">
                      <Icon className="w-6 h-6"/>
                    </div>
                    <h3 className="text-lg font-bold text-base-content mb-2">
                      {title}
                    </h3>
                    <p className="text-base-content/70 text-sm">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Divider */}
          {isDividerShow && (
            <div className="py-4">
              <div
                style={{
                  height: 1,
                  width: "100%",
                  maxWidth: "72rem",
                  margin: "0 auto",
                  backgroundColor: dividerColor,
                  opacity: 0.8,
                }}
              />
            </div>
          )}

          {/* Apps We've Built & What's Coming */}
          <section className="py-12">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
                Apps We&apos;ve Built &amp; What&apos;s Coming
              </h2>
              <p className="text-base-content/70 text-center mb-12 max-w-xl mx-auto">
                We focus on building multiple specialized apps, each solving a
                specific problem.
              </p>

              <div className="max-w-5xl mx-auto">
                {/* Delivered */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {DELIVERED_APPS.map((app) => (
                    <div
                      key={app.name}
                      className="flex items-center gap-3 glass-effect hover-lift px-5 py-4 rounded-xl"
                      style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                    >
                      <span className="shrink-0 inline-flex text-green-500"><CheckCircle className="w-5 h-5" /></span>
                      <img
                        src={app.logo}
                        alt={app.name}
                        className="w-8 h-8 shrink-0 rounded-lg object-contain"
                      />
                      <span className="font-medium text-base-content">
                        {app.name}
                      </span>
                      <span className="ml-auto shrink-0 badge badge-success badge-outline text-xs">
                        Delivered
                      </span>
                    </div>
                  ))}
                </div>

                {/* In Development */}
                <p className="mt-8 mb-4 text-center text-sm font-medium uppercase tracking-wide text-base-content/60">
                  In Development
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {IN_DEV_APPS.map((app) => (
                    <div
                      key={app.name}
                      className="glass-effect hover-lift px-5 py-4 rounded-xl"
                      style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="shrink-0 inline-flex items-center justify-center bg-amber-500/20 p-1.5 rounded-full text-amber-400"><Clock className="w-5 h-5 shrink-0" /></span>
                          <img
                            src={app.logo}
                            alt={app.name}
                            className="w-8 h-8 shrink-0 rounded-lg object-contain"
                          />
                          <span className="font-medium text-base-content">
                            {app.name}
                          </span>
                        </div>
                        <span className="shrink-0 badge badge-warning badge-outline text-xs">
                          In Dev
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-base-content/70 ml-8">
                        {app.desc.split("\n").map((line, i) => (
                          <span key={i}>
                            {i > 0 && <br />}
                            {line}
                          </span>
                        ))}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Planned */}
                <p className="mt-8 mb-4 text-center text-sm font-medium uppercase tracking-wide text-base-content/60">
                  Planned
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PLANNED_APPS.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 glass-effect hover-lift px-5 py-4 rounded-xl"
                      style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                    >
                      <span className="shrink-0 inline-flex items-center justify-center bg-sky-500/20 p-1.5 rounded-full text-sky-400"><Calendar className="w-5 h-5 shrink-0" /></span>
                      <span className="font-medium text-base-content">
                        {name}
                      </span>
                      <span className="ml-auto shrink-0 badge badge-info badge-outline text-xs">
                        Planned
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Divider */}
          {isDividerShow && (
            <div className="py-4">
              <div
                style={{
                  height: 1,
                  width: "100%",
                  maxWidth: "72rem",
                  margin: "0 auto",
                  backgroundColor: dividerColor,
                  opacity: 0.8,
                }}
              />
            </div>
          )}

          {/* Apps Section */}
          <section className="py-12">
            <div className="container mx-auto px-4 text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Contributions by @sagarkothari88 &amp; team
              </h2>
            </div>

            <AppsGrid
              apps={apps}
              cardBackgroundColor={cardBackgroundColor}
              cardShadow={cardShadow}
            />
          </section>

          {/* Divider */}
          {isDividerShow && (
            <div className="py-4">
              <div
                style={{
                  height: 1,
                  width: "100%",
                  maxWidth: "72rem",
                  margin: "0 auto",
                  backgroundColor: dividerColor,
                  opacity: 0.8,
                }}
              />
            </div>
          )}

          {/* Supporters */}
          <section className="py-12">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                Powered by
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {supporters.map((s, idx) => (
                  <div
                    key={idx}
                    className="card glass-effect hover-lift p-6 rounded-xl"
                    style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl" style={{ backgroundColor: dividerColor }}>
                      <img src={s.avatar} alt={s.title} className="h-full w-full object-cover" />
                    </div>
                    <h3 className="mt-3 text-lg font-semibold" style={{ color: textColor }}>{s.title}</h3>
                    <p className="mt-1 text-sm" style={{ color: textColor, opacity: 0.6 }}>{s.description}</p>
                    <div className="mt-4">
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                        style={{ backgroundColor: "#e31337" }}
                      >
                        {s.buttonText}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}

                {/* Contact Support */}
                <a
                  href="https://discord.gg/WEKa8JKg7W"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card glass-effect hover-lift flex flex-col p-6 rounded-xl"
                  style={{ backgroundColor: cardBackgroundColor, boxShadow: cardShadow }}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: dividerColor }}>
                    <img
                      src="https://cdn.simpleicons.org/discord/5865F2"
                      alt="Discord"
                      className="h-6 w-6"
                      width={24}
                      height={24}
                    />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold" style={{ color: textColor }}>Contact Support</h3>
                  <p className="mt-1 text-sm" style={{ color: textColor, opacity: 0.6 }}>Get help on Discord</p>
                  <div className="mt-4">
                    <span
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                      style={{ backgroundColor: "#e31337" }}
                    >
                      Join
                      <ExternalLink className="w-4 h-4" />
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </section>

          {/* Bottom Spacing */}
          <div className="py-20"></div>
        </>
        </main>

      </div>
    </div>
  );
};

export default HiveContributionsLanding;
