# AngularApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

---

## Changing brand fonts

All component SCSS files reference CSS custom properties defined once in `src/styles.scss`:

```scss
--v-font-heading:   'Fraunces', 'Playfair Display', Georgia, serif;
--v-font-body:      'Satoshi', 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
--v-font-accent:    'Cormorant Garamond', Georgia, serif;
```

**To change the headline or body font:**

1. Update CSS vars in `src/styles.scss` (`:root` block, lines 35-37)
2. Update Google Fonts / Fontshare `<link>` tags in `src/index.html`
3. Update the canonical spec in `vendia-models/vendia_models/dtos/tenant/defaults/vendia.yaml`
4. (Optional) Update the onboarding font dropdown options in `src/app/pages/onboarding/onboarding.html`

**Current fonts:**
- Headline: **Fraunces** (fallback: Playfair Display → Georgia → serif)
- Body: **Satoshi** (fallback: Montserrat → system-ui → sans-serif)
- Accent: **Cormorant Garamond** (fallback: Georgia → serif)


## Todos 

from libs import Oragon

class AragonTool():
    def get_agent_definition():
        return Oragon().aaaaa()

The Web3App enables Darosa token holders to create content to promote their business. 
 
Create a paid newsletter with storytelling, featuring the ideal customer,  the expert, and a fictional character, and also create content to promote the newsletter in different social media. 
 # vendia_app
