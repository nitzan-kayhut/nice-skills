# nice-skills — מאגר Skills ל-Claude Code

מאגר Hebrew/RTL לחיפוש, סינון ובחירת Claude Code skills לפגישות צוות.

## קבצים

- `skills.html` — UI בלבד. **לא לערוך** את התוכן/הנתונים בקובץ הזה.
- `skills-import.json` — מקור האמת לרשימת ה-skills. **תמיד לעדכן את הקובץ הזה.**

## כלל קריטי

כשהמשתמש שולח קישור ל-skill חדש (GitHub repo או דומה):

1. ✅ **תמיד עדכן את `skills-import.json`** — הוסף את ה-skill למערך `skills`.
2. ❌ **אל תערוך את `skills.html`** — לא להוסיף DEFAULT_SKILLS, לא לשנות את ה-loadData, כלום.

המשתמש מייבא את ה-JSON ל-HTML דרך כפתור "📂 ייבוא מ-JSON".

⚠️ הייבוא מחליף את כל המאגר ב-localStorage — לכן ה-JSON צריך להיות מצטבר (לכלול את כל ה-skills הקיימים + החדש).

## סכמת skill

```json
{
  "id": "sk-<slug>",
  "name": "<שם>",
  "cat": "<קטגוריה>",
  "desc": "<תיאור קצר בעברית>",
  "why": "<למה זה שווה לצוות, בעברית>",
  "source": "github.com/<user>/<repo>",
  "install": "<פקודת התקנה>"
}
```

## קטגוריות (`cat`)

`core` · `engineering` · `qa` · `devops` · `productivity` · `integrations` · `meta` · `data`

## תהליך להוספת skill חדש

1. קח את ה-URL מהמשתמש.
2. WebFetch ל-repo כדי להוציא: שם, תיאור, פקודת התקנה, ערך לצוות.
3. כתוב `desc` ו-`why` **בעברית** — תיאור ענייני + למה זה שימושי לצוות.
4. בחר `cat` מהרשימה למעלה.
5. ייצר `id` ייחודי בפורמט `sk-<slug>` (למשל `sk-code-discipline`).
6. הוסף את האובייקט למערך `skills` ב-`skills-import.json` (לא להחליף את הקיים).
7. עדכן את שדה `exported` לתאריך נוכחי.
