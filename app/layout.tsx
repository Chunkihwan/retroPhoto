import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    metadataBase: new URL('https://retro-photo-blond.vercel.app'),
    title: '레트로 스튜디오',
    description: '사진을 옛날 신문 느낌의 도트 이미지로 바꿔주는 브라우저 앱.',
    icons: {
        icon: '/favicon.svg',
        shortcut: '/favicon.svg',
    },
    openGraph: {
        title: '레트로 스튜디오',
        description: '사진을 옛날 신문 느낌의 도트 이미지로 바꿔주는 브라우저 앱.',
        url: '/',
        siteName: '레트로 스튜디오',
        type: 'website',
        locale: 'ko_KR',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: '레트로 스튜디오 공유 이미지',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: '레트로 스튜디오',
        description: '사진을 옛날 신문 느낌의 도트 이미지로 바꿔주는 브라우저 앱.',
        images: ['/og-image.png'],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko">
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
        </html>
    );
}
