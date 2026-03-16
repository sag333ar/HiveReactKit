import React from "react";
import AppsGrid from "./AppsGrid";
import Contact from "./Contact";
import { apps } from "../../data/appsData";
import {
  FaEye,
  FaBullseye,
  FaStar,
  FaRocket,
  FaCode,
  FaUsers,
  FaBolt,
  FaClock,
  FaCalendarAlt,
  FaCheckCircle,
} from "react-icons/fa";

const BELIEFS = [
  {
    icon: FaBolt,
    title: "Simplicity Wins",
    desc: "Blockchain technology should feel as easy as using any modern mobile app.",
  },
  {
    icon: FaCode,
    title: "Open Ecosystem",
    desc: "All our apps are open source so developers can learn, extend, and build.",
  },
  {
    icon: FaRocket,
    title: "Build First, Talk Later",
    desc: "We prefer shipping real products and improving with community feedback.",
  },
  {
    icon: FaUsers,
    title: "Community Over Ownership",
    desc: "These are tools built for the entire Hive ecosystem, not closed platforms.",
  },
];

const DELIVERED_APPS = [
  { name: "Distriator", logo: "/images/distriator_logo.png" },
  { name: "CheckInWithXYZ", logo: "/images/checkinwithxyz.png" },
  { name: "hReplier", logo: "/images/logo.png" },
  { name: "hStats", logo: "/images/stats_logo.png" },
  { name: "hPolls", logo: "/images/hpolls-logo.png" },
  { name: "hFestFacts", logo: "/images/hive-fest-fact-logo.png" },
  { name: "hSnaps", logo: "/images/hsnaps-logo.png" },
];

const IN_DEV_APPS = [
  {
    name: "hApprover",
    desc: "Approve Hive transactions from your phone",
    logo: "/images/happrover-logo.png",
  },
  {
    name: "hCurators",
    desc: "- Request to curate content on behalf of them for their communities.\n - We have staked Hive Power to curate & reward Hive content creators",
    logo: "/images/vote_logo.png",
  },
];

const PLANNED_APPS = [
  "hSurvey",
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
}

const HiveContributionsLanding: React.FC<HiveContributionsLandingProps> = ({
  backgroundColor = "#020617",      // near-slate-950
  textColor = "#e5e7eb",            // gray-200
  cardBackgroundColor = "rgba(15,23,42,0.85)", // translucent slate
  isDividerShow = true,
  dividerColor = "rgba(148,163,184,0.4)", // slate-400 with opacity
}) => {
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
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                      <FaEye className="w-6 h-6 text-primary" />
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
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                      <FaBullseye className="w-6 h-6 text-primary" />
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
                <div className="card glass-effect hover-lift p-6 rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                      <FaStar className="w-6 h-6 text-primary" />
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
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-primary" />
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
                      <FaCheckCircle className="w-5 h-5 shrink-0 text-success" />
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
                          <FaClock className="w-5 h-5 shrink-0 text-warning" />
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
                      <FaCalendarAlt className="w-5 h-5 shrink-0 text-info" />
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

          {/* Bottom Spacing */}
          <div className="py-20"></div>
        </main>

        {/* Contact Footer */}
        <Contact />
      </div>
    </div>
  );
};

export default HiveContributionsLanding;

