import React from 'react';

interface UserProfileImageProps {
  username: string;
  radius?: number;
  className?: string;
  onClick?: () => void;
}

const UserProfileImage: React.FC<UserProfileImageProps> = ({
  username,
  radius = 40,
  className = '',
  onClick
}) => {
  return (
    <div
      className={`avatar cursor-pointer ${className}`}
      onClick={onClick}
      style={{ width: radius, height: radius }}
    >
      <div className="w-full h-full rounded-full overflow-hidden">
        <img
          src={`https://images.hive.blog/u/${username}/avatar?id=test`}
          alt={`${username} avatar`}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/placeholder.svg';
          }}
        />
      </div>
    </div>
  );
};

export default UserProfileImage;