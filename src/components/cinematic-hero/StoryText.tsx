type StoryTextProps = {
  as?: 'h1' | 'h2';
  className?: string;
  id?: string;
  lines: string[];
  tone?: 'headline' | 'support';
};

export const StoryText = ({
  as: Heading = 'h2',
  className,
  id,
  lines,
  tone = 'headline',
}: StoryTextProps) => (
  <div className={`rtw-story-text rtw-story-text-${tone}${className ? ` ${className}` : ''}`}>
    <Heading id={id} className="rtw-story-heading">
      {lines.map((line) => (
        <span className="rtw-line-mask" key={line}>
          <span className="rtw-line-inner">{line}</span>
        </span>
      ))}
    </Heading>
  </div>
);
