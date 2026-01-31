import { Construction } from 'lucide-react';

export default function ComingSoon({ title = "Bu səhifə" }) {
  return (
    <div 
      className="flex flex-col items-center justify-center h-full min-h-[60vh]"
      data-testid="coming-soon-page"
    >
      <div className="text-center">
        <div 
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: '#9ACD3220' }}
        >
          <Construction className="w-10 h-10" style={{ color: '#9ACD32' }} />
        </div>
        <h2 
          className="text-2xl font-bold mb-2"
          style={{ color: '#3D4F6F' }}
        >
          {title}
        </h2>
        <p className="text-slate-500">
          Bu bölmə hazırlanma mərhələsindədir
        </p>
      </div>
    </div>
  );
}
