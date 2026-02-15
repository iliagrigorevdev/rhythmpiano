import * as PIXI from "pixi.js";

/**
 * Creates a button with support for dynamic color updates.
 */
function createButton(text, x, y, onClick, size = 60, initialColor = 0x333333) {
  const container = new PIXI.Container();
  container.x = x;
  container.y = y;
  container.eventMode = "static";
  container.cursor = "pointer";
  container.baseColor = initialColor;

  const bg = new PIXI.Graphics();
  container.addChild(bg);

  // Helper function to redraw the background
  const render = (color, alpha) => {
    bg.clear();
    bg.roundRect(-size / 2, -size / 2, size, size, 12);
    bg.fill({ color: color, alpha: alpha });
    bg.stroke({ width: 3, color: 0xffffff });
  };

  // Initial Draw
  render(initialColor, 0.9);

  const style = {
    fontFamily: "Arial",
    fontSize: size * 0.5,
    fill: 0xffffff,
    align: "center",
  };

  const textObj = new PIXI.Text({ text, style });
  textObj.anchor.set(0.5);
  container.addChild(textObj);

  // Expose method to update color externally
  container.updateColor = (color) => {
    container.baseColor = color;
    render(color, 1.0);
  };

  container.on("pointertap", (e) => onClick(e, container));

  container.on("pointerover", () => {
    render(container.baseColor, 1.0);
    container.scale.set(1.1);
  });
  container.on("pointerout", () => {
    render(container.baseColor, 0.9);
    container.scale.set(1.0);
  });

  return container;
}

/**
 * Initializes the User Interface elements.
 * @param {PIXI.Container} parentContainer - The container to add UI elements to.
 * @param {Object} dimensions - { width, height }
 * @param {Object} config - Configuration flags and data (title, demoMode, etc.)
 * @param {Object} callbacks - Functions to handle UI interactions (onPlay, onLoad, etc.)
 * @returns {Object} References to created UI elements { loadingText, titleText, menuContainer }
 */
export function initUI(parentContainer, { width, height }, config, callbacks) {
  const uiRefs = {
    loadingText: null,
    titleText: null,
    menuContainer: null,
  };

  // 1. Loading Text
  const style = {
    fontFamily: "Arial",
    fontSize: 32,
    fill: 0xffffff,
    align: "center",
    fontWeight: "bold",
    stroke: { color: 0x000000, width: 4 },
  };

  const loadingText = new PIXI.Text({ text: "Loading Sounds...", style });
  loadingText.x = width / 2;
  loadingText.y = height / 2 - 80;
  loadingText.anchor.set(0.5);
  parentContainer.addChild(loadingText);
  uiRefs.loadingText = loadingText;

  // 2. Title Rendering
  if (config.title) {
    const titleStyle = {
      fontFamily: "Arial",
      fontSize: 36,
      fill: 0xffffff,
      align: "center",
      fontWeight: "bold",
      stroke: { color: 0x000000, width: 4 },
    };
    const displayTitle = config.title
      // Handle standard camelCase (e.g., "myTitle" -> "my Title")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // Handle consecutive caps followed by lowercase (e.g., "GMajor" -> "G Major")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");

    const titleText = new PIXI.Text({ text: displayTitle, style: titleStyle });
    titleText.x = width / 2;
    titleText.y = 20;
    titleText.anchor.set(0.5, 0); // Top-center

    // Make Title interactive only if Demo Mode is active
    if (config.isDemoMode) {
      titleText.eventMode = "static";
      titleText.cursor = "pointer";
      titleText.on("pointertap", () => {
        if (callbacks.onDemoStart) callbacks.onDemoStart();
      });
    }

    parentContainer.addChild(titleText);
    uiRefs.titleText = titleText;
  }

  // 3. Menu Container
  const menuContainer = new PIXI.Container();
  menuContainer.visible = false;
  parentContainer.addChild(menuContainer);
  uiRefs.menuContainer = menuContainer;

  const buttonConfigs = [];

  // Load MIDI (📂)
  if (!config.hasMelody) {
    buttonConfigs.push({
      text: "📂",
      onClick: (e) => {
        e.stopPropagation();
        if (callbacks.onLoad) callbacks.onLoad();
      },
    });
  }

  if (!config.isDemoMode) {
    // Play Button (▶️)
    if (config.hasMelody || config.hasAccompaniment) {
      buttonConfigs.push({
        text: "▶️",
        onClick: () => {
          if (callbacks.onPlay) callbacks.onPlay();
        },
      });
    }

    // Controls active only if melody exists
    if (config.hasMelody) {
      // Wait Mode Toggle (⏳)
      buttonConfigs.push({
        text: "⏳",
        isToggle: true,
        initialState: config.initialWaitMode,
        onClick: (e, btnContainer) => {
          e.stopPropagation();
          const newState = callbacks.onToggleWait
            ? callbacks.onToggleWait()
            : false;
          const newColor = newState ? 0x2e8b57 : 0x333333;
          btnContainer.updateColor(newColor);
        },
      });

      // Slow Mode Toggle (🐢)
      buttonConfigs.push({
        text: "🐢",
        isToggle: true,
        initialState: config.initialSpeedMode,
        onClick: (e, btnContainer) => {
          e.stopPropagation();
          const newState = callbacks.onToggleSpeed
            ? callbacks.onToggleSpeed()
            : false;
          const newColor = newState ? 0x2e8b57 : 0x333333;
          btnContainer.updateColor(newColor);
        },
      });

      // Share (🔗)
      buttonConfigs.push({
        text: "🔗",
        onClick: async () => {
          if (callbacks.onShare) callbacks.onShare();
        },
      });
    }
  }

  // Info Button (ℹ️)
  buttonConfigs.push({
    text: "ℹ️",
    onClick: () => {
      alert(
        "🎹 Audio Credits:\n\nSalamander Grand Piano V3\nAuthor: Alexander Holm\nLicense: CC BY 3.0",
      );
    },
  });

  // Calculate layout to center items
  const btnSize = 70;
  const gap = 20;
  const totalWidth =
    buttonConfigs.length * btnSize + (buttonConfigs.length - 1) * gap;
  let currentX = width / 2 - totalWidth / 2 + btnSize / 2;
  const yPos = height / 2 - 80;

  buttonConfigs.forEach((conf) => {
    let initialColor = 0x333333;
    if (conf.isToggle && conf.initialState) {
      initialColor = 0x2e8b57;
    }

    const btn = createButton(
      conf.text,
      currentX,
      yPos,
      conf.onClick,
      btnSize,
      initialColor,
    );
    menuContainer.addChild(btn);
    currentX += btnSize + gap;
  });

  return uiRefs;
}
