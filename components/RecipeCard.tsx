import type { Recipe } from '@/lib/menus';
import SaveButton from './SaveButton';

export default function RecipeCard({
  recipe,
  number,
  menuSlug,
  priority = false,
}: {
  recipe: Recipe;
  number: number;     // מספר המתכון (1, 2, 3...)
  menuSlug?: string;  // עבור מעקב קליקים
  priority?: boolean; // true למתכון הראשון (משפר LCP)
}) {
  // קישור דרך /go לספירת קליק (מקור: page = מתוך העמוד)
  const href = menuSlug ? `/go/${menuSlug}/${number - 1}/page` : recipe.url;
  return (
    <article className="card">
      <a className="thumb" href={href} target="_blank" rel="noopener">
        <img
          src={recipe.image}
          alt={recipe.title}
          width={600}
          height={375}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
        <span className="num">{number}</span>
        <span className="badge">⏱️ {recipe.time}</span>
      </a>
      <SaveButton />
      <div className="body">
        <h3>{recipe.title}</h3>
        {recipe.author && <span className="recipe-author">👩‍🍳 {recipe.author}</span>}
        <p className="desc">{recipe.desc}</p>
        <div className="foot">
          <span className="stat">{recipe.level ? `📊 ${recipe.level}` : ''}</span>
          <a className="btn-go" href={href} target="_blank" rel="noopener">למתכון ←</a>
        </div>
      </div>
    </article>
  );
}
