export const launchUrl = (url: string) => {
  window.open(url, '_blank');
};

export const launchEmail = (email: string) => {
  const emailUrl = `mailto:${email}`;
  window.open(emailUrl, '_self');
};