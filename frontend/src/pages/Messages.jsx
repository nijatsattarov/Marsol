import { Construction, MessageSquare } from 'lucide-react';

export default function Messages() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center h-[60vh]">
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#9ACD3220' }}>
          <MessageSquare className="w-10 h-10" style={{ color: '#9ACD32' }} />
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#3D4F6F' }}>Mesajlar</h2>
        <p className="text-slate-500 mb-4">Bu bölmə hazırlanma mərhələsindədir</p>
        <p className="text-sm text-slate-400">Daxili kommunikasiya modulu tezliklə əlavə olunacaq</p>
      </div>
    </div>
  );
}
