import Image from 'next/image';
import type { Recipe } from '@/lib/menus';
import SaveButton from './SaveButton';

export default function RecipeCard({
  recipe,
  number,
  priority = false,
}: {
  recipe: Recipe;
  number: number;     // מספר המתכון (1, 2, 3...)
  priority?: boolean; // true למתכון הראשון (משפר LCP)
}) {
  return (
    <article className="card">
      <a className="thumb" href={recipe.url} target="_blank" rel="noopener">
        <Image
          src={recipe.image}
          alt={recipe.title}
          width={600}
          height={375}
          sizes="(max-width:768px) 100vw, 380px"
          priority={priority}
          loading={priority ? 'eager' : 'lazy'}
        />
        <span className="num">{number}</span>
        <span className="badge">⏱️ {recipe.time}</span>
      </a>
      <SaveButton />
      <div className="body">
        <h3>{recipe.title}</h3>
        <p className="desc">{recipe.desc}</p>
        <div className="foot">
          <span className="stat">📊 {recipe.level}</span>
          <a className="btn-go" href={recipe.url} target="_blank" rel="noopener">למתכון ←</a>
        </div>
      </div>
    </article>
  );
}
