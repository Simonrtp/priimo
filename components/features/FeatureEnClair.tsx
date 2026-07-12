type FeatureEnClairProps = {
  text: string;
};

export default function FeatureEnClair({ text }: FeatureEnClairProps) {
  return (
    <aside className="my-10 rounded-r-xl border-l-4 border-accent bg-[#FFF7F0] px-6 py-5 sm:px-7">
      <p className="text-[11px] font-semibold uppercase text-[#E8743C] [letter-spacing:0.08em]">En clair</p>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-700 text-pretty sm:text-base">{text}</p>
    </aside>
  );
}
