import React, { useState } from "react";
import AppsGrid from "./AppsGrid";
import Contact from "./Contact";
import ExpensesView from "./ExpensesView";
import { apps } from "../../data/appsData";
import { ECENCY_IMAGES } from "../../data/ecencyImageUrls";

// Inline SVGs to avoid react-icons dependency in packaged build (prevents "Objects are not valid as a React child" when consumer has different React instance)
const svgProps = { viewBox: "0 0 512 512", fill: "currentColor" };
const IconEye = () => (
  <svg {...svgProps} className="w-6 h-6"><path d="M256 105c-101.8 0-185 82.2-185 185 0 101.8 82.2 185 185 185s185-82.2 185-185c0-102.8-82.2-185-185-185zm0 323c-76.2 0-138-61.8-138-138s61.8-138 138-138 138 61.8 138 138-61.8 138-138 138zm0-229c-50.2 0-91 40.8-91 91s40.8 91 91 91 91-40.8 91-91-40.8-91-91-91z"/></svg>
);
const IconBullseye = () => (
  <svg {...svgProps} className="w-6 h-6"><path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zm0 448c-106 0-192-86-192-192S150 64 256 64s192 86 192 192-86 192-192 192zm0-320c-70.7 0-128 57.3-128 128s57.3 128 128 128 128-57.3 128-128-57.3-128-128-128zm0 208c-44.2 0-80-35.8-80-80s35.8-80 80-80 80 35.8 80 80-35.8 80-80 80zm0-112c-17.7 0-32 14.3-32 32s14.3 32 32 32 32-14.3 32-32-14.3-32-32-32z"/></svg>
);
const IconStar = () => (
  <svg {...svgProps} className="w-6 h-6"><path d="M256 0l67 136 149 22-108 105 25 147-133-70-133 70 25-147-108-105 149-22z"/></svg>
);
const IconBolt = () => (
  <svg {...svgProps} className="w-6 h-6"><path d="M288 0l-64 224h96l-64 288 256-320h-96z"/></svg>
);
const IconCode = () => (
  <svg {...svgProps} className="w-6 h-6"><path d="M156 132l-64 64 64 64 20-20-44-44 44-44zm200 0l-20 20 44 44-44 44 20 20 64-64zm-244 76h288v-32H112z"/></svg>
);
const IconRocket = () => (
  <svg {...svgProps} className="w-6 h-6"><path d="M256 0c-32 64-96 128-96 224v128l96 32 96-32V224c0-96-64-160-96-224z"/></svg>
);
const IconUsers = () => (
  <svg {...svgProps} className="w-6 h-6"><path d="M256 256c35.3 0 64-28.7 64-64s-28.7-64-64-64-64 28.7-64 64 28.7 64 64 64zm-64 64c-70.7 0-128 57.3-128 128v32h256v-32c0-70.7-57.3-128-128-128H192zm256 0c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64zm64 64c0-70.7-57.3-128-128-128-35.3 0-64 28.7-64 64s28.7 64 64 64h128v32z"/></svg>
);
const IconClock = () => (
  <svg {...svgProps} className="w-6 h-6" aria-hidden><path d="M256 64C150 64 64 150 64 256s86 192 192 192 192-86 192-192S362 64 256 64zm0 352c-88.2 0-160-71.8-160-160S167.8 96 256 96s160 71.8 160 160-71.8 160-160 160zm16-176h-96v-32h80V128h32v80h-16z"/></svg>
);
const IconCalendar = () => (
  <svg {...svgProps} className="w-6 h-6"><path d="M128 0h32v64h192V0h32v64h32c35.3 0 64 28.7 64 64v320c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128c0-35.3 28.7-64 64-64h32V0zm288 128H96v320h320V128zm-256 64h64v64h-64v-64zm96 0h64v64h-64v-64zm-96 96h64v64h-64v-64zm96 0h64v64h-64v-64zm96-96h64v64h-64v-64zm0 96h64v64h-64v-64z"/></svg>
);
const IconCheckCircle = () => (
  <svg {...svgProps} className="w-6 h-6"><path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zm128 192l-160 160-64-64 22.6-22.6 41.4 41.4 137.4-137.4L384 192z"/></svg>
);

const BELIEFS = [
  { icon: IconBolt, title: "Simplicity Wins", desc: "Blockchain technology should feel as easy as using any modern mobile app." },
  { icon: IconCode, title: "Open Ecosystem", desc: "All our apps are open source so developers can learn, extend, and build." },
  { icon: IconRocket, title: "Build First, Talk Later", desc: "We prefer shipping real products and improving with community feedback." },
  { icon: IconUsers, title: "Community Over Ownership", desc: "These are tools built for the entire Hive ecosystem, not closed platforms." },
];

const DELIVERED_APPS = [
  { name: "Distriator", logo: ECENCY_IMAGES.distriator_logo },
  { name: "CheckInWithXYZ", logo: ECENCY_IMAGES.checkinwithxyz },
  { name: "hReplier", logo: ECENCY_IMAGES.hreplier },
  { name: "hStats", logo: ECENCY_IMAGES.stats_logo },
  { name: "hPolls", logo: ECENCY_IMAGES.hpolls_logo },
  { name: "hFestFacts", logo: ECENCY_IMAGES.hive_fest_fact_logo },
  { name: "hSnaps", logo: ECENCY_IMAGES.template },
];

const IN_DEV_APPS = [
  {
    name: "hApprover",
    desc: "Approve Hive transactions from your phone",
    logo: ECENCY_IMAGES.happrover_logo,
  },
  {
    name: "hCurators",
    desc: "- Request to curate content on behalf of them for their communities.\n - We have staked Hive Power to curate & reward Hive content creators",
    logo: ECENCY_IMAGES.vote_logo,
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
  isExpensesCTA?: boolean;
}

const LIGHTEST_RED = "#f87171";

const HiveContributionsLanding: React.FC<HiveContributionsLandingProps> = ({
  backgroundColor = "#020617",      // near-slate-950
  textColor = "#e5e7eb",            // gray-200
  cardBackgroundColor = "rgba(15,23,42,0.85)", // translucent slate
  isDividerShow = true,
  dividerColor = "rgba(148,163,184,0.4)", // slate-400 with opacity
  isExpensesCTA = false,
}) => {
  const cardShadow = "0 18px 45px rgba(0,0,0,0.6)";
  const [showExpenses, setShowExpenses] = useState(false);

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
          {showExpenses ? (
            <ExpensesView
              onBack={() => setShowExpenses(false)}
              backgroundColor={backgroundColor}
              textColor={textColor}
              cardBackgroundColor={cardBackgroundColor}
              dividerColor={dividerColor}
            />
          ) : (
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
                      <IconEye />
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
                      <IconBullseye />
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
                      <IconStar />
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
                  onClick={() => setShowExpenses(true)}
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
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-4 text-primary">
                      <Icon />
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
                      <span className="shrink-0 text-success [&_svg]:w-5 [&_svg]:h-5 inline-flex text-green-500"><IconCheckCircle /></span>
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
                          <span className="shrink-0 inline-flex items-center justify-center bg-amber-500/20 p-1.5 rounded-full text-amber-400 [&_svg]:w-5 [&_svg]:h-5 [&_svg]:shrink-0"><IconClock /></span>
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
                      <span className="shrink-0 inline-flex items-center justify-center bg-sky-500/20 p-1.5 rounded-full text-sky-400 [&_svg]:w-5 [&_svg]:h-5 [&_svg]:shrink-0"><IconCalendar /></span>
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
        </>
          )}
        </main>

        {/* Contact Footer */}
        <Contact />
      </div>
    </div>
  );
};

export default HiveContributionsLanding;

