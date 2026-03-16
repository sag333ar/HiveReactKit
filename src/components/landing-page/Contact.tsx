import React from 'react';
import { FaTwitter, FaGithub, FaEnvelope, FaDiscord } from 'react-icons/fa';
import { launchUrl, launchEmail } from '../../utils/actions';

const Contact: React.FC = () => {
  const socialLinks = [
    {
      icon: FaTwitter,
      href: "https://x.com/sagarkothari88",
      bgColor: "bg-blue-500",
      label: "Twitter"
    },
    {
      icon: FaDiscord,
      href: "https://discord.gg/WEKa8JKg7W",
      bgColor: "bg-indigo-600",
      label: "Discord"
    }
  ];

  const handleClick = (link: typeof socialLinks[0]) => {
    launchUrl(link.href);
  };

  return (
    <footer className="bg-base-300 py-8">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <h3 className="text-2xl font-bold text-base-content">
            Contact us
          </h3>

          <div className="flex gap-4">
            {socialLinks.map((link, index) => (
              <button
                key={index}
                onClick={() => handleClick(link)}
                className={`btn btn-circle ${link.bgColor} text-white hover:scale-110 transition-transform duration-200`}
                aria-label={link.label}
              >
                <link.icon className="w-5 h-5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Contact;