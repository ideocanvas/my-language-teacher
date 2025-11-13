import { ArrowUpDown, Download, Upload, Shield, Zap, Users } from 'lucide-react'
import Link from 'next/link'
import { getDictionary, Locale } from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/language-switcher'
import BuyMeACoffee from '@/components/BuyMeACoffee'

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const dict = await getDictionary(lang as Locale)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ArrowUpDown className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                {dict.home.title}
              </h1>
            </div>
            <LanguageSwitcher currentLocale={lang} />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            {dict.home.heroTitle}
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            {dict.home.heroDescription}
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Receive Files Card */}
          <Link href={`/${lang}/receive`} className="group">
            <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-gray-200 hover:border-blue-300 transform hover:-translate-y-1">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                  <Download className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{dict.home.receiveFiles}</h3>
                <p className="text-gray-600 mb-6">
                  {dict.home.receiveDescription}
                </p>
                <div className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold group-hover:bg-blue-700 transition-colors">
                  {dict.home.startReceiving}
                </div>
              </div>
            </div>
          </Link>

          {/* Send Files Card */}
          <Link href={`/${lang}/send`} className="group">
            <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 border border-gray-200 hover:border-green-300 transform hover:-translate-y-1">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-colors">
                  <Upload className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{dict.home.sendFiles}</h3>
                <p className="text-gray-600 mb-6">
                  {dict.home.sendDescription}
                </p>
                <div className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold group-hover:bg-green-700 transition-colors">
                  {dict.home.startSending}
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{dict.home.featurePrivate}</h3>
            <p className="text-gray-600">{dict.home.featurePrivateDesc}</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{dict.home.featureNoLimits}</h3>
            <p className="text-gray-600">{dict.home.featureNoLimitsDesc}</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{dict.home.featureEasyConnection}</h3>
            <p className="text-gray-600">{dict.home.featureEasyConnectionDesc}</p>
          </div>
        </div>
      </main>
      
      <BuyMeACoffee language={lang as 'en' | 'zh-TW'} />
    </div>
  )
}