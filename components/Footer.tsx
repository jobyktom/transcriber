import React from 'react';
import { MailIcon } from './icons';

interface FooterProps {
    error: string | null;
    translationError: string | null;
}

export const Footer: React.FC<FooterProps> = ({ error, translationError }) => {
    const finalError = error || translationError;

    const createMailtoLink = () => {
        const recipient = "Joe.tom@deckers.com";
        const subject = "Issue Report: Video Intelligence Platform";
        const body = `Hi Joe,\n\nI encountered an issue with the Video Intelligence Platform.\n\nError details:\n---\n${finalError}\n---\n\nPlease assist.\n\nThanks,`;
        return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return (
        <footer className="bg-[#2b2b2b] border-t border-[#3a3a3a] mt-auto">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-400 gap-4">
                <p>&copy; {new Date().getFullYear()} Deckers Brands. All rights reserved. | Developed by: Joe.tom@deckers.com</p>
                {finalError && (
                    <a
                        href={createMailtoLink()}
                        className="flex items-center gap-2 bg-red-800 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        <MailIcon />
                        Report an Issue
                    </a>
                )}
            </div>
        </footer>
    );
};