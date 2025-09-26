import React, { useEffect, useState, type JSX } from "react";
import {
  FaWallet,
  FaMoneyBill,
  FaPiggyBank,
  FaCoins,
  FaBolt,
  FaExclamationTriangle,
} from "react-icons/fa";
import { useWalletStore } from "../store/walletStore";

interface WalletProps {
  username?: string;
  className?: string;
}

interface WalletTileProps {
  label: string;
  value?: string;
  icon?: JSX.Element;
  colorClass?: string;
}

export const Wallet: React.FC<WalletProps> = ({ username, className = "" }) => {
  const { walletData, fetchWalletData, isLoading, error } = useWalletStore();

  // Fetch wallet data
  useEffect(() => {
    if (username) fetchWalletData(username);
  }, [username, fetchWalletData]);

  // Single tile component
  const WalletTile: React.FC<WalletTileProps> = ({ label, value, icon, colorClass = "bg-primary/10" }) => (
    <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border shadow-sm mb-3 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center gap-3">
        {icon && (
          <div className={`p-2 rounded-full flex items-center justify-center ${colorClass} text-primary`}>
            {icon}
          </div>
        )}
        <span className="font-semibold text-card-foreground">{label}</span>
      </div>
      <span className="font-medium text-muted-foreground">{value ?? "-"}</span>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gradient-elegant p-4 transition-all duration-300 ${className}`}>
      <div className="max-w-md mx-auto">
        {/* Profile Header */}
        <div className="flex flex-col items-center p-6 mb-6 rounded-xl bg-card border border-border shadow-elegant">
          {username && (
            <img
              src={`https://images.hive.blog/u/${username}/avatar`}
              alt={`${username} avatar`}
              className="w-20 h-20 rounded-full border-4 border-primary/20 mb-3 transition-transform hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${username}&background=random`;
              }}
            />
          )}
          <div className="text-lg font-bold text-card-foreground">{username}</div>
          <div className="text-sm text-muted-foreground">
            Hive Wallet Overview
          </div>
        </div>

        {/* Estimated Value Card */}
        <div className="text-center rounded-xl bg-gradient-primary shadow-glow p-6 mb-6 transition-all duration-300 hover:shadow-elegant">
          <div className="text-sm font-semibold text-primary-foreground/80">Estimated Value</div>
          <div className="text-3xl font-bold mt-2 text-primary-foreground">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                Loading...
              </div>
            ) : (
              walletData?.estimated_value ?? "-"
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive mb-4">
            <FaExclamationTriangle className="mr-2" />
            <span>{error}</span>
          </div>
        )}

        <WalletTile
          label="Balance"
          value={walletData?.balance}
          icon={<FaWallet />}
          colorClass="bg-blue-500/10"
        />
        <WalletTile
          label="HBD Balance"
          value={walletData?.hbd_balance}
          icon={<FaMoneyBill />}
          colorClass="bg-green-500/10"
        />
        <WalletTile
          label="Savings Balance"
          value={walletData?.savings_balance}
          icon={<FaPiggyBank />}
          colorClass="bg-yellow-500/10"
        />
        <WalletTile
          label="Savings HBD Balance"
          value={walletData?.savings_hbd_balance}
          icon={<FaCoins />}
          colorClass="bg-purple-500/10"
        />
        <WalletTile
          label="Hive Power"
          value={walletData?.hive_power}
          icon={<FaBolt />}
          colorClass="bg-orange-500/10"
        />
      </div>
    </div>
  );
};

export default Wallet;