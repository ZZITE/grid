import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
  memo,
} from "react";
import Toolbar from "./Toolbar";
import Formulabar from "./Formulabar";
import Workbook from "./Workbook";
import {
  theme,
  ThemeProvider,
  ColorModeProvider,
  Flex,
  useToast,
} from "@chakra-ui/core";
import { Global, css } from "@emotion/core";
import {
  CellInterface,
  SelectionArea,
  ScrollCoords,
  AreaProps,
  FilterView,
  FilterDefinition,
  useUndo,
  SelectionPolicy,
} from "@rowsncolumns/grid";
import {
  createNewSheet,
  uuid,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_ROW_HEIGHT,
  SYSTEM_FONT,
  format as defaultFormat,
  FONT_FAMILIES,
  detectDataType,
  getMinMax,
  COLUMN_HEADER_HEIGHT,
  ROW_HEADER_WIDTH,
} from "./constants";
import {
  FORMATTING_TYPE,
  CellFormatting,
  AXIS,
  BORDER_VARIANT,
  BORDER_STYLE,
  Formatter,
  SELECTION_MODE,
} from "./types";
import { WorkbookGridRef } from "./Grid/Grid";
import { KeyCodes, Direction } from "@rowsncolumns/grid/dist/types";
import invariant from "tiny-invariant";
import { ThemeType } from "./styled";
import Editor, { CustomEditorProps } from "./Editor/Editor";
import StatusBarComponent from "./StatusBar";
import { StatusBarProps } from "./StatusBar/StatusBar";
import useFonts from "./hooks/useFonts";
import {
  createStateReducer,
  ACTION_TYPE,
  StateInterface,
  ActionTypes,
} from "./state";
import { Patch, applyPatches } from "immer";
import { ContextMenuComponentProps } from "./ContextMenu/ContextMenu";
import ContextMenuComponent from "./ContextMenu";
import TooltipComponent, { TooltipProps } from "./Tooltip";
import validate, { ValidationResponse } from "./validation";
import useCalc from "./hooks/useCalc";

export interface SpreadSheetProps {
  /**
   * Minimum column width of the grid
   */
  minColumnWidth?: number;
  /**
   * Minimum row height of the grid
   */
  minRowHeight?: number;
  /**
   * Column header height
   */
  columnHeaderHeight?: number;
  /**
   * Row header width
   */
  rowHeaderWidth?: number;
  /**
   * Customize cell rendering
   */
  CellRenderer?: React.ReactType;
  /**
   * Custom header cell
   */
  HeaderCellRenderer?: React.ReactType;
  /**
   * Array of sheets to render
   */
  sheets?: Sheet[];
  /**
   * Uncontrolled sheets
   */
  initialSheets?: Sheet[];
  /**
   * Active  sheet on the workbook
   */
  initialActiveSheet?: string;
  /**
   * Callback fired when cells are modified
   */
  onChangeCell?: (
    id: SheetID,
    value: React.ReactText,
    cell: CellInterface
  ) => void;
  /**
   * Callback when multiple cells change
   * Eg: Delete action
   */
  onChangeCells?: (id: SheetID, changes: Cells) => void;
  /**
   * Get the new selected sheet
   */
  onChangeSelectedSheet?: (id: SheetID) => void;
  /**
   * Listen to changes to all the sheets
   */
  onChange?: (sheets: Sheet[]) => void;
  /**
   * Show formula bar
   */
  showFormulabar?: boolean;
  /**
   * Show hide toolbar
   */
  showToolbar?: boolean;
  /**
   * Conditionally format cell text
   */
  formatter?: Formatter;
  /**
   * Enabled or disable dark mode
   */
  enableDarkMode?: true;
  /**
   * Font family
   */
  fontFamily?: string;
  /**
   * Min Height of the grid
   */
  minHeight?: number;
  /**
   * Custom Cell Editor
   */
  CellEditor?: React.ReactType<CustomEditorProps>;
  /**
   * Allow user to customize single, multiple or range selection
   */
  selectionPolicy?: SelectionPolicy;
  /**
   * Callback when active cell changes
   */
  onActiveCellChange?: (
    /* Sheet id */
    id: SheetID,
    /* Cell coords */
    cell: CellInterface | null,
    /* Value of the active cell */
    value?: React.ReactText
  ) => void;

  /**
   * Callback When active cell values changes
   */
  onActiveCellValueChange?: (
    /* Sheet id */
    id: SheetID,
    /* Cell coords  */
    cell: CellInterface | null,
    /* Value of the active cell */
    value?: React.ReactText
  ) => void;
  /**
   * Callback fired when selection changes
   */
  onSelectionChange?: (
    id: SheetID,
    activeCell: CellInterface | null,
    selections: SelectionArea[]
  ) => void;
  /**
   * Select mode
   */
  selectionMode?: SELECTION_MODE;
  /**
   * Show or hide tab strip
   */
  showTabStrip?: boolean;
  /**
   * Make tab editable
   */
  isTabEditable?: boolean;
  /**
   * Allow user to add new sheet
   */
  allowNewSheet?: boolean;
  /**
   * Show or hide status bar
   */
  showStatusBar?: boolean;
  /**
   * Status bar component
   */
  StatusBar?: React.ReactType<StatusBarProps>;
  /**
   * Context menu component
   */
  ContextMenu?: React.ReactType<ContextMenuComponentProps>;
  /**
   * Tooltip component
   */
  Tooltip?: React.ReactType<TooltipProps>;
  /**
   * Scale
   */
  initialScale?: number;
  /**
   * When scale changes
   */
  onScaleChange?: (scale: number) => void;
  /**
   * Web font loader config
   */
  fontLoaderConfig?: WebFont.Config;
  /**
   * Visible font families
   */
  fontList?: string[];
  /**
   * Snap to row and column as user scrolls
   */
  snap?: boolean;
  /**
   * Add your own state interface
   */
  stateReducer?: (state: StateInterface, action: ActionTypes) => StateInterface;
  /**
   * Custom onvalidator
   */
  onValidate?: (
    value: React.ReactText,
    id: SheetID,
    cell: CellInterface,
    cellConfig: CellConfig | undefined
  ) => Promise<ValidationResponse>;
  /**
   * By default, all keydown listeners are bound to the grid.
   * If you want to bind listeners to `document` for events such as undo/redo,
   * Toggle this to true
   */
  enableGlobalKeyHandlers?: boolean;
  /**
   * Pass custom functions to calculation engine
   */
  formulas?: FormulaMap;
  /**
   * When user fill a cell
   */
  onFill?: (
    id: SheetID,
    activeCell: CellInterface,
    fillSelection: SelectionArea | null,
    selections: SelectionArea[]
  ) => void;
  /**
   * When user adds a new sheet
   */
  onAddNewSheet?: (sheet: Sheet) => void;
  /**
   * When sheet name changes
   */
  onSheetNameChange?: (id: SheetID, name: string) => void;
  /**
   * When a sheet is deleted
   */
  onDeleteSheet?: (id: SheetID) => void;
  /**
   * When a sheet is duplicated. Index is insertion index
   */
  onDuplicateSheet?: (sheet: Sheet, index: number) => void;
  /**
   * When a column or row is resized
   */
  onResize?: (
    id: SheetID,
    axis: AXIS,
    index: number,
    dimension: number
  ) => void;
  /**
   * When a row is inserted
   */
  onInsertRow?: (id: SheetID, activeCell: CellInterface) => void;
  /**
   * When a column is inserted
   */
  onInsertColumn?: (id: SheetID, activeCell: CellInterface) => void;
  /**
   * When a row is deleted
   */
  onDeleteRow?: (id: SheetID, activeCell: CellInterface) => void;
  /**
   * When a columnb is dleted
   */
  onDeleteColumn?: (id: SheetID, activeCell: CellInterface) => void;
  /**
   * When sheet is visible from hidden state
   */
  onShowSheet?: (id: SheetID) => void;
  /**
   * When sheet is hidden
   */
  onHideSheet?: (id: SheetID) => void;
  /**
   * When sheet is protected
   */
  onProtectSheet?: (id: SheetID) => void;
  /**
   * When sheet is unprotected
   */
  onUnProtectSheet?: (id: SheetID) => void;
  /**
   * When sheet color changes
   */
  onSheetColorChange?: (id: SheetID, color?: string) => void;
  /**
   * When user changes formatting of a cell/selections
   */
  onFormattingChange?: (
    id: SheetID,
    key: keyof CellFormatting,
    value: any
  ) => void;
  /**
   * Callback when users deletes cells
   */
  onDeleteCells?: (
    id: SheetID,
    activeCell: CellInterface,
    selections: SelectionArea[]
  ) => void;
  /**
   * Callback when user changes frozen columns
   */
  onFrozenColumnsChange?: (id: SheetID, count: number) => void;
  /**
   * Callback when user changes frozen columns
   */
  onFrozenRowsChange?: (id: SheetID, count: number) => void;
  /**
   * Clear formatting
   */
  onClearFormatting?: (id: SheetID) => void;
  /**
   * Disable formula calculation
   */
  disableFormula?: boolean;
  /**
   * Color of the grid lines
   */
  gridLineColor?: string;
  /**
   * Background color of grid
   */
  gridBackgroundColor?: string;
}

export type FormulaMap = Record<string, (...args: any[]) => any>;

export type CellConfigGetter = (
  id: SheetID,
  cell: CellInterface | null
) => CellConfig | undefined;

export type CellConfigBySheetNameGetter = (
  name: string,
  cell: CellInterface | null
) => CellConfig | undefined;

export interface Sheet {
  id: SheetID;
  name: string;
  cells: Cells;
  activeCell: CellInterface | null;
  selections: SelectionArea[];
  scrollState?: ScrollCoords;
  columnSizes?: SizeType;
  rowSizes?: SizeType;
  mergedCells?: AreaProps[];
  frozenRows?: number;
  frozenColumns?: number;
  hiddenRows?: number[];
  hiddenColumns?: number[];
  showGridLines?: boolean;
  filterViews?: FilterView[];
  rowCount?: number;
  columnCount?: number;
  locked?: boolean;
  hidden?: boolean;
  tabColor?: string;
}

export type SheetID = React.ReactText;
export type CellsBySheet = Record<string, Cells>;

export type SizeType = {
  [key: number]: number;
};

export type Cells = Record<string, Cell>;
export type Cell = Record<string, CellConfig>;
export interface CellConfig extends CellFormatting {
  /**
   * Text that will be displayed in the cell.
   * For formulas, result will be displayed instead
   */
  text?: string | number;
  /**
   * Add tooltip
   */
  tooltip?: string;
  /**
   * Result from formula calculation
   */
  result?: string | number | boolean | Date;
  /**
   * Formula errors
   */
  error?: string;
  /**
   * Validation errors
   */
  valid?: boolean;
}

const defaultActiveSheet = uuid();
export const defaultSheets: Sheet[] = [
  {
    id: defaultActiveSheet,
    name: "Sheet1",
    rowCount: 1000,
    columnCount: 26,
    frozenColumns: 0,
    frozenRows: 0,
    activeCell: {
      rowIndex: 1,
      columnIndex: 1,
    },
    mergedCells: [],
    selections: [],
    cells: {},
    scrollState: { scrollTop: 0, scrollLeft: 0 },
    filterViews: [],
  },
];

export type RefAttributeSheetGrid = {
  ref?: React.Ref<SheetGridRef>;
};

export type SheetGridRef = {
  grid: WorkbookGridRef | null;
};

export interface PatchInterface {
  patches: Patch;
  inversePatches: Patch;
}

export const initialState: StateInterface = {
  selectedSheet: 0,
  sheets: defaultSheets,
  currentActiveCell: null,
  currentSelections: null,
};

/**
 * Spreadsheet component
 * TODO
 * 1. Undo/redo on formula cells does not clear old formula cos of async nature
 * @param props
 */
const Spreadsheet: React.FC<SpreadSheetProps & RefAttributeSheetGrid> = memo(
  forwardRef((props, forwardedRef) => {
    const {
      /* Controlled, to persist the state, always provide onChange */
      sheets: sheetsProp,
      /* Uncontrolled, to persist provide onChange */
      initialSheets = defaultSheets,
      showFormulabar = true,
      minColumnWidth = DEFAULT_COLUMN_WIDTH,
      columnHeaderHeight = COLUMN_HEADER_HEIGHT,
      rowHeaderWidth = ROW_HEADER_WIDTH,
      minRowHeight = DEFAULT_ROW_HEIGHT,
      CellRenderer,
      HeaderCellRenderer,
      initialActiveSheet,
      onChangeSelectedSheet,
      onChange,
      onChangeCell,
      onChangeCells,
      showToolbar = true,
      formatter = defaultFormat,
      enableDarkMode = true,
      fontFamily = SYSTEM_FONT,
      minHeight = 400,
      CellEditor = Editor,
      onActiveCellChange,
      onActiveCellValueChange,
      onSelectionChange,
      selectionMode,
      showTabStrip = true,
      isTabEditable = true,
      allowNewSheet = true,
      showStatusBar = true,
      StatusBar = StatusBarComponent,
      ContextMenu = ContextMenuComponent,
      Tooltip = TooltipComponent,
      initialScale = 1,
      onScaleChange,
      fontLoaderConfig,
      fontList = FONT_FAMILIES,
      selectionPolicy,
      snap = false,
      stateReducer,
      onValidate = validate,
      enableGlobalKeyHandlers = false,
      formulas,
      onFill,
      onAddNewSheet,
      onSheetNameChange,
      onDeleteSheet,
      onDuplicateSheet,
      onResize,
      onInsertRow,
      onInsertColumn,
      onDeleteRow,
      onDeleteColumn,
      onShowSheet,
      onHideSheet,
      onProtectSheet,
      onUnProtectSheet,
      onSheetColorChange,
      onFormattingChange,
      onDeleteCells,
      onFrozenRowsChange,
      onFrozenColumnsChange,
      onClearFormatting,
      disableFormula,
      gridLineColor,
      gridBackgroundColor,
    } = props;

    /* Last active cells: for undo, redo */
    const lastActiveCellRef = useRef<CellInterface | null>(null);
    const lastSelectionsRef = useRef<SelectionArea[] | null>([]);
    const [scale, setScale] = useState(initialScale);
    const currentGrid = useRef<WorkbookGridRef>(null);
    const [formulaInput, setFormulaInput] = useState("");
    const { current: isControlled } = useRef<boolean>(sheetsProp !== void 0);
    /* Add it to ref to prevent closures */
    const getCellConfigRef = useRef<CellConfigGetter>();
    const getCellConfigBySheetNameRef = useRef<CellConfigBySheetNameGetter>();
    const getSheetRef = useRef<(id: SheetID) => Sheet | undefined>();
    const [valueState, setValueState] = useState<StateInterface>(() => {
      return {
        currentSelections: null,
        currentActiveCell: null,
        sheets: initialSheets,
        selectedSheet: isControlled
          ? sheetsProp?.[0].id
          : initialActiveSheet ?? initialSheets[0].id ?? sheetsProp?.[0].id,
      };
    });
    const currentStateRef = useRef<StateInterface>();
    const state: StateInterface = isControlled
      ? { ...valueState, sheets: sheetsProp as Sheet[] }
      : valueState;
    const { sheets, currentActiveCell, currentSelections } = state;

    const [sheetsById, sheetsByName] = useMemo(() => {
      const initial: [Record<string, Sheet>, Record<string, Sheet>] = [{}, {}];
      return sheets.reduce((acc, sheet) => {
        acc[0][sheet.id] = sheet;
        acc[1][sheet.name] = sheet;
        return acc;
      }, initial);
    }, [sheets]);

    /* Make sure selected sheet is present in the sheets */
    const selectedSheet =
      (state.selectedSheet ?? "") in sheetsById
        ? state.selectedSheet
        : sheets[0].id;
    const selectedSheetRef = useRef<SheetID>();

    /**
     * Exit early if selected sheet is invalid
     */
    invariant(
      selectedSheet !== void 0 && selectedSheet !== null,
      "Exception, selectedSheet is empty, Please specify a selected sheet using `selectedSheet` prop"
    );

    /* So we can access sheet in closures */
    useEffect(() => {
      selectedSheetRef.current = selectedSheet;
    }, [selectedSheet]);

    /* Keep a reference to previous state */
    useEffect(() => {
      if (!isControlled) {
        onChange?.(state.sheets);
      } else {
        currentStateRef.current = state;
      }
    }, [state, isControlled]);

    /**
     * State reducer
     */
    const currentStateReducer = useCallback(() => {
      return createStateReducer({ addUndoPatch, getCellBounds, stateReducer });
    }, []);
    const dispatch = useCallback(
      (action: ActionTypes) => {
        /**
         * Previous state of controlled component is saved in ref
         * currentStateRef.current is kept in sync with  newState
         */
        if (isControlled) {
          if (!currentStateRef.current) return;
          const newState = currentStateReducer()(
            currentStateRef.current,
            action
          );
          updateState(newState);
        } else {
          /**
           * Use local state
           */
          setValueState((prevState) => {
            return currentStateReducer()(prevState, action);
          });
        }
      },
      [isControlled]
    );

    /**
     * Warn users when they switch from controlled to uncontrolled
     */
    useEffect(() => {
      const nextIsControlled = sheetsProp !== void 0;
      const nextMode = nextIsControlled ? "a controlled" : "an uncontrolled";
      const mode = isControlled ? "a controlled" : "an uncontrolled";
      if (isControlled !== nextIsControlled) {
        console.warn(
          `Your component is changing from ${mode} to ${nextMode}.Components should not switch from controlled to uncontrolled (or vice versa).` +
            `Use initialSheets for uncontrolled and sheets and onChange for controlled SpreadSheet`
        );
      }
    }, [isControlled]);

    /**
     * Update local state or triggers callback
     */
    const updateState = useCallback(
      (newState: StateInterface) => {
        if (newState.selectedSheet !== currentStateRef.current?.selectedSheet) {
          setValueState((prev) => {
            return {
              ...prev,
              selectedSheet: newState.selectedSheet,
            };
          });
        }

        /**
         * If active cell changes
         * For undo/redo
         */
        if (
          newState.currentActiveCell !==
            currentStateRef.current?.currentActiveCell ||
          newState.currentSelections !==
            currentStateRef.current?.currentSelections
        ) {
          setValueState((prev) => {
            return {
              ...prev,
              currentActiveCell:
                newState.currentActiveCell || prev.currentActiveCell,
              currentSelections:
                newState.currentSelections || prev.currentSelections,
            };
          });
        }

        if (newState.selectedSheet !== state.selectedSheet) {
          onChangeSelectedSheet?.(newState.selectedSheet as React.ReactText);
        }

        /* Update current reference */
        currentStateRef.current = newState;

        /* Call back */
        onChange?.(newState.sheets);
      },
      [isControlled]
    );

    /* Current sheet */
    const currentSheet = sheetsById[selectedSheet];

    /**
     * Get cell config
     */
    const getCellConfig = useCallback(
      (id: SheetID, cell: CellInterface | null): CellConfig | undefined => {
        if (!cell) return void 0;
        return sheetsById?.[id]?.cells?.[cell.rowIndex]?.[cell.columnIndex];
      },
      [sheetsById]
    );

    /**
     * Get cell config
     */
    const getCellConfigBySheetName = useCallback(
      (name: string, cell: CellInterface | null): CellConfig | undefined => {
        if (!cell) return void 0;
        return sheetsByName?.[name]?.cells?.[cell.rowIndex]?.[cell.columnIndex];
      },
      [sheetsByName]
    );

    /* Get sheet by id */
    const getSheet = useCallback(
      (id: SheetID) => {
        return sheetsById?.[id];
      },
      [sheetsById]
    );

    useEffect(() => {
      getCellConfigRef.current = getCellConfig;
      getCellConfigBySheetNameRef.current = getCellConfigBySheetName;
      getSheetRef.current = getSheet;
    }, [getCellConfig, getCellConfigBySheetName, getSheet]);

    /**
     * Calculation
     */

    const { initializeEngine, onCalculateBatch } = useCalc({
      formulas,
      getCellConfig: getCellConfigBySheetNameRef,
    });

    /**
     * Some grid side-effects during undo/redo
     */
    const beforeUndoRedo = useCallback((patches: Patch[]) => {
      const hasFilterViews = patches.some((item) =>
        item.path.includes("filterViews")
      );
      if (hasFilterViews) {
        currentGrid.current?.resetAfterIndices?.({ rowIndex: 0 }, false);
      }
    }, []);

    /**
     *
     */
    const patchHasCellChanges = useCallback((patches: Patch[]) => {
      return patches.some((patch) => {
        return patch.path[0] === "sheets" && patch.path?.[2] === "cells";
      });
    }, []);

    /**
     * Undo hook
     */
    const {
      add: addUndoPatch,
      canRedo,
      canUndo,
      undo,
      redo,
      onKeyDown: onUndoKeyDown,
    } = useUndo<Patch[]>({
      enableGlobalKeyHandlers,
      onUndo: (patches) => {
        /* Side-effects */
        beforeUndoRedo(patches);

        dispatch({
          type: ACTION_TYPE.APPLY_PATCHES,
          patches,
          undoable: false,
        });

        if (patchHasCellChanges(patches) && selectedSheetRef.current) {
          cellChangeCallback(
            selectedSheetRef.current,
            lastActiveCellRef.current,
            lastSelectionsRef.current,
            true
          );
        }

        if (lastActiveCellRef.current) {
          setActiveCell(lastActiveCellRef.current);
        }
        if (lastSelectionsRef.current) {
          setSelections(lastSelectionsRef.current);
        }
        /* Focus on the grid */
        if (enableGlobalKeyHandlers) currentGrid.current?.focus();
      },
      onRedo: (patches) => {
        /* Side-effects */
        beforeUndoRedo(patches);

        dispatch({
          type: ACTION_TYPE.APPLY_PATCHES,
          patches,
          undoable: false,
        });

        const activeCellPatch = patches.find((item: Patch) =>
          item.path.includes("currentActiveCell")
        );
        const selectionsPatch = patches.find((item: Patch) =>
          item.path.includes("currentSelections")
        );

        if (patchHasCellChanges(patches) && selectedSheetRef.current) {
          cellChangeCallback(
            selectedSheetRef.current,
            activeCellPatch?.value,
            selectionsPatch?.value,
            true
          );
        }

        if (activeCellPatch) {
          setActiveCell(activeCellPatch.value);
        }
        if (selectionsPatch) {
          setSelections(selectionsPatch.value);
        }

        /* Focus on the grid */
        if (enableGlobalKeyHandlers) currentGrid.current?.focus();
      },
    });

    /**
     * Toast notifications
     */
    const toast = useToast();

    /* Update active cell: Imperatively */
    const setActiveCell = useCallback((cell: CellInterface | null) => {
      if (!cell) return;
      currentGrid.current?.setActiveCell(cell);
    }, []);

    /* Update active selections: Imperatively */
    const setSelections = useCallback((selections: SelectionArea[] | null) => {
      if (!selections) return;
      currentGrid.current?.setSelections(selections);
    }, []);

    /**
     * Get cell bounds
     */
    const getCellBounds = useCallback((cell: CellInterface | null) => {
      if (!cell) return undefined;
      return currentGrid.current?.getCellBounds?.(cell);
    }, []);

    /* Last */
    useEffect(() => {
      lastActiveCellRef.current = currentActiveCell ?? null;
      lastSelectionsRef.current = currentSelections ?? null;
    }, [currentActiveCell, currentSelections]);

    /* Selected sheet */
    const setSelectedSheet = useCallback(
      (id: React.ReactText) => {
        if (id === selectedSheetRef.current) {
          return;
        }
        dispatch({
          type: ACTION_TYPE.SELECT_SHEET,
          id,
        });
      },
      [selectedSheet]
    );

    /* Fonts */
    const { isFontActive } = useFonts(fontLoaderConfig);

    /* Callback fired when fonts are loaded */
    useEffect(() => {
      if (isFontActive) {
        currentGrid.current?.resetAfterIndices?.({
          rowIndex: 0,
          columnIndex: 0,
        });
      }
    }, [isFontActive]);

    /* Callback fired when scale changes */
    useEffect(() => {
      onScaleChange?.(scale);
    }, [scale]);

    useImperativeHandle(
      forwardedRef,
      () => {
        return {
          grid: currentGrid.current,
        };
      },
      []
    );

    /**
     * Handle add new sheet
     */
    const handleNewSheet = useCallback(() => {
      const count = sheets.length;
      const newSheet = createNewSheet({ count: count + 1 });
      dispatch({
        type: ACTION_TYPE.NEW_SHEET,
        sheet: newSheet,
      });

      /* Focus on the new grid */
      currentGrid.current?.focus();

      /* Callback */
      onAddNewSheet?.(newSheet);
    }, [sheets, selectedSheet]);

    /**
     * Trigger batch calculation
     * @param changes
     */
    const triggerBatchCalculation = useCallback(
      async (
        sheet: string,
        id: SheetID,
        cell: CellInterface | null,
        changes: CellsBySheet
      ) => {
        /**
         * Simple trick to delay showing loading indicator
         * If async results come too soon.
         */
        let receivedResponse = false;
        let loadingShown = false;
        const LOADING_INDICATOR_DELAY = 100;

        if (cell) {
          setTimeout(() => {
            if (receivedResponse) {
              return;
            }
            dispatch({
              type: ACTION_TYPE.SET_LOADING,
              id,
              cell,
              value: true,
              undoable: false,
            });

            loadingShown = true;
          }, LOADING_INDICATOR_DELAY);
        }
        const values = await onCalculateBatch?.(sheet, changes);

        /* Set flag to true so dont show loading indicator */
        receivedResponse = true;

        if (cell && loadingShown) {
          dispatch({
            type: ACTION_TYPE.SET_LOADING,
            id,
            cell,
            value: false,
            undoable: false,
          });
        }

        if (values !== void 0) {
          dispatch({
            type: ACTION_TYPE.UPDATE_CELLS,
            changes: values,
          });
        }
      },
      []
    );

    /**
     * Trigger batch calciulation
     * @param changes
     */
    const triggerBatchInitialization = useCallback(
      async (changes: CellsBySheet) => {
        const values = await initializeEngine?.(changes);
        if (values !== void 0) {
          dispatch({
            type: ACTION_TYPE.UPDATE_CELLS,
            changes: values,
            undoable: false,
          });
        }
      },
      []
    );

    useEffect(() => {
      const initial: CellsBySheet = {};
      const changes = sheets.reduce((acc, sheet) => {
        acc[sheet.name] = sheet.cells;
        return acc;
      }, initial);

      /* Trigger batch calculation */
      triggerBatchInitialization(changes);
    }, []);

    /**
     * Get max rows in a sheet
     */
    const getMinMaxRows = useCallback(
      (sheet: SheetID) => {
        return getMinMax(sheetsById[sheet]?.cells);
      },
      [getCellConfig]
    );

    /**
     * Get max columns in a sheet row
     */
    const getMinMaxColumns = useCallback(
      (sheet: SheetID, rowIndex: number) => {
        return getMinMax(sheetsById[sheet].cells?.[rowIndex]);
      },
      [getCellConfig]
    );

    /**
     * Active cell + Active cell config.
     * Used in toolbars
     */
    const [activeCellConfig, activeCell] = useMemo(() => {
      const sheet = getSheet(selectedSheet);
      return [getCellConfig(selectedSheet, sheet.activeCell), sheet.activeCell];
    }, [getSheet, selectedSheet, getCellConfig]);

    /**
     * Cell changes on user input
     * General purpos changes
     */
    const handleChange = useCallback(
      async (id: SheetID, value: React.ReactText, cell: CellInterface) => {
        const config = getCellConfigRef.current?.(id, cell);
        let datatype = detectDataType(value);
        /* If user has disabled */
        if (disableFormula && datatype === "formula") {
          datatype = "string";
        }

        dispatch({
          type: ACTION_TYPE.CHANGE_SHEET_CELL,
          value,
          datatype,
          id,
          cell,
        });

        /* Trigger onChange cell callback */
        onChangeCell?.(id, value, cell);

        /* Validate */
        const validationResponse = await onValidate(value, id, cell, config);

        /* If validations service fails, lets not update the store */
        if (validationResponse !== void 0) {
          /**
           * Extract valid: boolean response and message
           */
          const { valid, message } = validationResponse as ValidationResponse;

          /**
           * Update the state
           */
          dispatch({
            type: ACTION_TYPE.VALIDATION_SUCCESS,
            cell,
            id,
            valid,
            prompt: message,
            undoable: false,
          });
        }

        cellChangeCallback(id, cell);
      },
      [disableFormula]
    );

    const handleSheetAttributesChange = useCallback(
      (
        id: SheetID,
        {
          activeCell,
          selections,
        }: { activeCell: CellInterface | null; selections: SelectionArea[] }
      ) => {
        dispatch({
          type: ACTION_TYPE.SHEET_SELECTION_CHANGE,
          id,
          activeCell,
          selections,
          undoable: false,
        });
      },
      []
    );

    /**
     * Handle sheet name
     */
    const handleChangeSheetName = useCallback(
      (id: SheetID, name: string) => {
        /**
         * Validate sheet name
         */
        if (name in sheetsByName && sheetsByName[name].id !== id) {
          return toast({
            title: "There was a problem",
            description: `Sheet with the name ${name} exists. Please enter another name`,
            status: "error",
            isClosable: true,
            duration: 90000,
          });
        }
        dispatch({
          type: ACTION_TYPE.CHANGE_SHEET_NAME,
          id,
          name,
        });

        onSheetNameChange?.(id, name);
      },
      [sheetsByName]
    );

    const handleDeleteSheet = useCallback(
      (id: SheetID) => {
        if (sheets.length === 1) return;

        dispatch({
          type: ACTION_TYPE.DELETE_SHEET,
          id,
        });

        onDeleteSheet?.(id);

        /* Focus on the new grid */
        currentGrid.current?.focus();
      },
      [sheets, selectedSheet]
    );

    const handleDuplicateSheet = useCallback(
      (id: SheetID) => {
        const newSheetId = uuid();
        const index = sheets.findIndex((sheet) => sheet.id === id);
        if (index === -1) return;
        const newSheet = {
          ...sheets[index],
          locked: false,
          id: newSheetId,
          name: `Copy of ${currentSheet.name}`,
        };

        dispatch({
          type: ACTION_TYPE.NEW_SHEET,
          sheet: newSheet,
          index,
        });

        onDuplicateSheet?.(newSheet, index);
      },
      [sheets, selectedSheet]
    );

    /**
     * Change formatting to auto
     */
    const handleFormattingChangeAuto = useCallback(() => {
      dispatch({
        type: ACTION_TYPE.FORMATTING_CHANGE_AUTO,
        id: selectedSheet,
      });

      const sheet = getSheetRef.current?.(selectedSheet);
      if (sheet) {
        cellChangeCallback(
          selectedSheet,
          sheet.activeCell,
          sheet.selections,
          true
        );
      }
    }, [selectedSheet]);

    /**
     * Change formatting to plain
     */
    const handleFormattingChangePlain = useCallback(() => {
      dispatch({
        type: ACTION_TYPE.FORMATTING_CHANGE_PLAIN,
        id: selectedSheet,
      });

      const sheet = getSheetRef.current?.(selectedSheet);
      if (sheet) {
        cellChangeCallback(
          selectedSheet,
          sheet.activeCell,
          sheet.selections,
          true
        );
      }
    }, [selectedSheet]);

    /**
     * When cell or selection formatting change
     */
    const handleFormattingChange = useCallback(
      (key, value) => {
        dispatch({
          type: ACTION_TYPE.FORMATTING_CHANGE,
          id: selectedSheet,
          key,
          value,
        });

        onFormattingChange?.(selectedSheet, key, value);

        const sheet = getSheetRef.current?.(selectedSheet);
        if (sheet) {
          cellChangeCallback(
            selectedSheet,
            sheet.activeCell,
            sheet.selections,
            true
          );
        }
      },
      [selectedSheet]
    );

    const handleActiveCellChange = useCallback(
      (id: SheetID, cell: CellInterface | null, value) => {
        if (!cell) return;
        setFormulaInput(value || "");
        onActiveCellChange?.(id, cell, value);
      },
      []
    );

    const handleActiveCellValueChange = useCallback(
      (id: SheetID, activeCell: CellInterface | null, value) => {
        setFormulaInput(value);
        onActiveCellValueChange?.(id, activeCell, value);
      },
      []
    );

    /**
     * Formula bar focus event
     */
    const handleFormulabarFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        const input = e.target;
        if (activeCell) {
          currentGrid.current?.makeEditable(activeCell, input.value, false);
          requestAnimationFrame(() => input?.focus());
        }
      },
      [activeCell]
    );

    /**
     * When formula input changes
     */
    const handleFormulabarChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!activeCell) return;
        const value = e.target.value;
        setFormulaInput(value);
        /* Row and column headers */
        if (activeCell?.rowIndex === 0 || activeCell?.columnIndex === 0) {
          return;
        }
        currentGrid.current?.setEditorValue(value, activeCell);
      },
      [activeCell, selectedSheet]
    );

    /**
     * Imperatively submits the editor
     * @param value
     * @param activeCell
     */
    const submitEditor = (
      value: string,
      activeCell: CellInterface,
      direction: Direction = Direction.Down
    ) => {
      const nextActiveCell = currentGrid.current?.getNextFocusableCell(
        activeCell,
        direction
      );
      currentGrid.current?.submitEditor(value, activeCell, nextActiveCell);
    };
    /**
     * When user presses Enter on formula input
     */
    const handleFormulabarKeydown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!activeCell) return;
        /* Row and column headers */
        if (activeCell?.rowIndex === 0 || activeCell?.columnIndex === 0) {
          return;
        }

        if (e.which === KeyCodes.Enter) {
          submitEditor(formulaInput, activeCell);
        }
        if (e.which === KeyCodes.Escape) {
          currentGrid.current?.cancelEditor();
          setFormulaInput(activeCellConfig?.text?.toString() || "");
        }
        if (e.which === KeyCodes.Tab) {
          submitEditor(formulaInput, activeCell, Direction.Right);
          e.preventDefault();
        }
      },
      [activeCell, formulaInput, activeCellConfig]
    );

    /**
     * Handle fill
     */
    const handleFill = useCallback(
      (
        id: SheetID,
        activeCell: CellInterface,
        fillSelection: SelectionArea | null,
        selections: SelectionArea[]
      ) => {
        if (!fillSelection) return;

        dispatch({
          type: ACTION_TYPE.UPDATE_FILL,
          id,
          activeCell,
          fillSelection,
          selections,
        });

        /* Callback */
        onFill?.(id, activeCell, fillSelection, selections);

        /* Focus on the new grid */
        currentGrid.current?.focus();

        /* Trigger Formula */
        cellChangeCallback(id, activeCell, [fillSelection]);
      },
      [sheets]
    );

    /**
     * Trigger after change handler
     * @param id Trigg
     * @param activeCell
     * @param selections
     */
    const cellChangeCallback = useCallback(
      (
        id: SheetID,
        activeCell: CellInterface | null,
        selections?: SelectionArea[] | null,
        skipFormula: boolean = false
      ) => {
        const sheetName = getSheetRef.current?.(id)?.name;
        const shouldRecalc = !disableFormula && !skipFormula;
        if (!sheetName) return;
        /**
         * If formula mode onChangeCells callback is empty, Skip
         */
        if (!onChangeCells && !shouldRecalc) {
          return;
        }
        const sel =
          selections && selections.length
            ? selections
            : [{ bounds: getCellBounds(activeCell) as AreaProps }];

        const changes: CellsBySheet = {
          [sheetName]: {},
        };
        const cellChanges: Cells = {};

        window.requestAnimationFrame(async () => {
          for (let i = 0; i < sel.length; i++) {
            const { bounds } = sel[i];
            for (
              let rowIndex = bounds?.top;
              rowIndex <= bounds?.bottom;
              rowIndex++
            ) {
              for (
                let columnIndex = bounds?.left;
                columnIndex <= bounds?.right;
                columnIndex++
              ) {
                const cellConfig =
                  getCellConfigRef.current?.(id, { rowIndex, columnIndex }) ??
                  {};
                cellChanges[rowIndex] = cellChanges[rowIndex] ?? {};
                cellChanges[rowIndex][columnIndex] = cellConfig;
                // Prevent unnecessary objects
                if (shouldRecalc) {
                  changes[sheetName][rowIndex] =
                    changes[sheetName][rowIndex] ?? {};
                  changes[sheetName][rowIndex][columnIndex] = cellConfig;
                }
              }
            }
          }

          /* Trigger Batch Calculation */
          if (shouldRecalc) {
            triggerBatchCalculation(sheetName, id, activeCell, changes);
          }

          /* OnChange cell */
          onChangeCells?.(id, cellChanges);
        });
      },
      [disableFormula]
    );

    /**
     * Delete cell values
     */
    const handleDelete = useCallback(
      (id: SheetID, activeCell: CellInterface, selections: SelectionArea[]) => {
        dispatch({
          type: ACTION_TYPE.DELETE_CELLS,
          id,
          activeCell,
          selections,
        });

        setFormulaInput("");

        onDeleteCells?.(id, activeCell, selections);

        cellChangeCallback(id, activeCell, selections);
      },
      []
    );

    /**
     * Clear formatting of selected area
     */
    const handleClearFormatting = useCallback(() => {
      dispatch({
        type: ACTION_TYPE.CLEAR_FORMATTING,
        id: selectedSheet,
      });

      onClearFormatting?.(selectedSheet);
    }, [selectedSheet]);

    /**
     * Trigger row or column resize
     */
    const handleResize = useCallback(
      (id: SheetID, axis: AXIS, index: number, dimension: number) => {
        dispatch({
          type: ACTION_TYPE.RESIZE,
          id,
          index,
          dimension,
          axis,
          undoable: false,
        });

        axis === AXIS.X
          ? currentGrid.current?.resizeColumns?.([index])
          : currentGrid.current?.resizeRows?.([index]);

        onResize?.(id, axis, index, dimension);
      },
      []
    );

    /**
     * Handle toggle cell merges
     */
    const handleMergeCells = useCallback(() => {
      dispatch({
        type: ACTION_TYPE.MERGE_CELLS,
        id: selectedSheet,
      });
    }, [selectedSheet]);

    const handleFrozenRowChange = useCallback(
      (count) => {
        dispatch({
          type: ACTION_TYPE.FROZEN_ROW_CHANGE,
          id: selectedSheet,
          count,
        });

        onFrozenRowsChange?.(selectedSheet, count);
      },
      [selectedSheet]
    );

    const handleFrozenColumnChange = useCallback(
      (count) => {
        dispatch({
          type: ACTION_TYPE.FROZEN_COLUMN_CHANGE,
          id: selectedSheet,
          count,
        });

        onFrozenColumnsChange?.(selectedSheet, count);
      },
      [selectedSheet]
    );

    const handleBorderChange = useCallback(
      (
        color: string | undefined,
        borderStyle: BORDER_STYLE,
        variant?: BORDER_VARIANT
      ) => {
        dispatch({
          type: ACTION_TYPE.SET_BORDER,
          id: selectedSheet,
          color,
          borderStyle,
          variant,
        });
      },
      [selectedSheet]
    );

    /**
     * Handle sheet scroll
     */
    const handleScroll = useCallback(
      (id: SheetID, scrollState: ScrollCoords) => {
        dispatch({
          type: ACTION_TYPE.UPDATE_SCROLL,
          id,
          scrollState,
          undoable: false,
        });
      },
      []
    );

    /**.
     * On Paste
     * TODO: Preserve formatting
     */
    const handlePaste = useCallback(
      (
        id: SheetID,
        rows,
        activeCell: CellInterface | null,
        selection?: SelectionArea
      ) => {
        if (!activeCell) return;
        const { rowIndex, columnIndex } = activeCell;
        const endRowIndex = Math.max(rowIndex, rowIndex + rows.length - 1);
        const endColumnIndex = Math.max(
          columnIndex,
          columnIndex + (rows.length && rows[0].length - 1)
        );

        dispatch({
          type: ACTION_TYPE.PASTE,
          id,
          rows,
          activeCell,
          selection,
        });

        /* Trigger callback and calculation */
        cellChangeCallback(
          id,
          activeCell,
          selection === void 0 ? void 0 : [selection]
        );

        if (activeCell) {
          const value = getCellConfigRef.current?.(id, activeCell)?.text;
          handleActiveCellValueChange(id, activeCell, value);
        }

        /* Should select */
        if (rowIndex === endRowIndex && columnIndex === endColumnIndex) return;

        currentGrid.current?.setSelections([
          {
            bounds: {
              top: rowIndex,
              left: columnIndex,
              bottom: endRowIndex,
              right: endColumnIndex,
            },
          },
        ]);
      },
      []
    );

    const handleCopy = useCallback(
      (id: SheetID, selections: SelectionArea[]) => {
        dispatch({
          type: ACTION_TYPE.COPY,
          id,
          undoable: false,
        });
      },
      []
    );

    /**
     * Handle cut event
     */
    const handleCut = useCallback((id: SheetID, selection: SelectionArea) => {
      dispatch({
        type: ACTION_TYPE.REMOVE_CELLS,
        id,
        activeCell: null,
        selections: [selection],
      });
    }, []);

    /**
     * Insert new row
     */
    const handleInsertRow = useCallback(
      (id: SheetID, activeCell: CellInterface | null) => {
        if (activeCell === null) return;
        dispatch({
          type: ACTION_TYPE.INSERT_ROW,
          id,
          activeCell,
        });

        onInsertRow?.(id, activeCell);
      },
      []
    );

    /**
     * Insert new row
     */
    const handleInsertColumn = useCallback(
      (id: SheetID, activeCell: CellInterface | null) => {
        if (activeCell === null) return;
        dispatch({
          type: ACTION_TYPE.INSERT_COLUMN,
          id,
          activeCell,
        });

        onInsertColumn?.(id, activeCell);
      },
      []
    );

    /* Handle delete row */
    const handleDeleteRow = useCallback(
      (id: SheetID, activeCell: CellInterface | null) => {
        if (activeCell === null) return;
        dispatch({
          type: ACTION_TYPE.DELETE_ROW,
          id,
          activeCell,
        });

        onDeleteRow?.(id, activeCell);
      },
      []
    );

    /* Handle delete row */
    const handleDeleteColumn = useCallback(
      (id: SheetID, activeCell: CellInterface | null) => {
        if (activeCell === null) return;
        dispatch({
          type: ACTION_TYPE.DELETE_COLUMN,
          id,
          activeCell,
        });

        onDeleteColumn?.(id, activeCell);
      },
      []
    );

    /**
     * Handle keydown events
     */
    const handleKeyDown = useCallback(
      (
        id: SheetID,
        event: React.KeyboardEvent<HTMLDivElement>,
        activeCell: CellInterface | null
      ) => {
        if (!activeCell) return;
        const isMeta = event.metaKey || event.ctrlKey;
        const isShift = event.shiftKey;
        const keyCode = event.which;
        switch (keyCode) {
          case KeyCodes.KEY_B:
            if (!isMeta) return;
            handleFormattingChange(
              FORMATTING_TYPE.BOLD,
              !getCellConfig(id, activeCell)?.bold
            );
            break;

          case KeyCodes.KEY_I:
            if (!isMeta) return;
            handleFormattingChange(
              FORMATTING_TYPE.ITALIC,
              !getCellConfig(id, activeCell)?.italic
            );
            break;

          case KeyCodes.KEY_U:
            if (!isMeta) return;
            handleFormattingChange(
              FORMATTING_TYPE.UNDERLINE,
              !getCellConfig(id, activeCell)?.underline
            );
            break;

          case KeyCodes.KEY_X:
            if (!isMeta || !isShift) return;
            handleFormattingChange(
              FORMATTING_TYPE.STRIKE,
              !getCellConfig(id, activeCell)?.strike
            );
            break;

          case KeyCodes.BACK_SLASH:
            if (!isMeta) return;
            handleClearFormatting();
            event?.preventDefault();
            break;

          case KeyCodes.KEY_L:
          case KeyCodes.KEY_E:
          case KeyCodes.KEY_R:
            if (!isMeta || !isShift) return;
            const align =
              keyCode === KeyCodes.KEY_L
                ? "left"
                : keyCode === KeyCodes.KEY_E
                ? "center"
                : "right";
            handleFormattingChange(FORMATTING_TYPE.HORIZONTAL_ALIGN, align);
            event?.preventDefault();
            break;
        }

        /* Pass it on to undo hook */
        onUndoKeyDown?.(event);
      },
      [getCellConfig]
    );

    /**
     * Update filters views
     */
    const handleChangeFilter = useCallback(
      (
        id: SheetID,
        filterViewIndex: number,
        columnIndex: number,
        filter?: FilterDefinition
      ) => {
        /* Todo, find rowIndex based on filterViewIndex */
        currentGrid.current?.resetAfterIndices?.({ rowIndex: 0 }, false);

        dispatch({
          type: ACTION_TYPE.CHANGE_FILTER,
          id,
          filterViewIndex,
          columnIndex,
          filter,
        });
      },
      []
    );

    /**
     * Callback when scale changes
     */
    const handleScaleChange = useCallback(
      (value) => {
        /* Update grid dimensions */
        currentGrid.current?.resetAfterIndices?.(
          { rowIndex: 0, columnIndex: 0 },
          false
        );
        /* Set scale */
        setScale(value);
      },
      [selectedSheet]
    );

    const handleShowSheet = useCallback((id: SheetID) => {
      dispatch({
        type: ACTION_TYPE.SHOW_SHEET,
        id,
      });

      onShowSheet?.(id);
    }, []);

    const handleHideSheet = useCallback((id: SheetID) => {
      dispatch({
        type: ACTION_TYPE.HIDE_SHEET,
        id,
      });

      onHideSheet?.(id);
    }, []);

    const handleProtectSheet = useCallback((id: SheetID) => {
      dispatch({
        type: ACTION_TYPE.PROTECT_SHEET,
        id,
      });

      onProtectSheet?.(id);
    }, []);

    const handleUnProtectSheet = useCallback((id: SheetID) => {
      dispatch({
        type: ACTION_TYPE.UNPROTECT_SHEET,
        id,
      });

      onUnProtectSheet?.(id);
    }, []);

    const handleChangeTabColor = useCallback((id: SheetID, color?: string) => {
      dispatch({
        type: ACTION_TYPE.CHANGE_TAB_COLOR,
        id,
        color,
      });

      onSheetColorChange?.(id);
    }, []);

    return (
      <>
        <Global
          styles={css`
            .rowsncolumns-spreadsheet {
              font-family: ${fontFamily};
            }
            .Toaster {
              font-family: ${fontFamily};
              font-size: 0.875rem;
            }
            .Toaster button {
              background: none;
              border: none;
              color: white;
              cursor: pointer;
            }
            .rowsncolumns-spreadsheet *,
            .rowsncolumns-spreadsheet *:before,
            .rowsncolumns-spreadsheet *:after {
              box-sizing: border-box;
            }
            .rowsncolumns-grid-container:focus {
              outline: none;
            }
          `}
        />

        <Flex
          flexDirection="column"
          flex={1}
          minWidth={0}
          minHeight={minHeight}
          className="rowsncolumns-spreadsheet"
        >
          {showToolbar ? (
            <Toolbar
              wrap={activeCellConfig?.wrap}
              datatype={activeCellConfig?.datatype}
              plaintext={activeCellConfig?.plaintext}
              format={activeCellConfig?.format}
              fontSize={activeCellConfig?.fontSize}
              fontFamily={activeCellConfig?.fontFamily}
              fill={activeCellConfig?.fill}
              bold={activeCellConfig?.bold}
              italic={activeCellConfig?.italic}
              strike={activeCellConfig?.strike}
              underline={activeCellConfig?.underline}
              color={activeCellConfig?.color}
              percent={activeCellConfig?.percent}
              currency={activeCellConfig?.currency}
              verticalAlign={activeCellConfig?.verticalAlign}
              horizontalAlign={activeCellConfig?.horizontalAlign}
              onFormattingChange={handleFormattingChange}
              onFormattingChangeAuto={handleFormattingChangeAuto}
              onFormattingChangePlain={handleFormattingChangePlain}
              onClearFormatting={handleClearFormatting}
              onMergeCells={handleMergeCells}
              frozenRows={currentSheet.frozenRows}
              frozenColumns={currentSheet.frozenColumns}
              onFrozenRowChange={handleFrozenRowChange}
              onFrozenColumnChange={handleFrozenColumnChange}
              onBorderChange={handleBorderChange}
              onRedo={redo}
              onUndo={undo}
              canRedo={canRedo}
              canUndo={canUndo}
              enableDarkMode={enableDarkMode}
              scale={scale}
              onScaleChange={handleScaleChange}
              fontList={fontList}
            />
          ) : null}
          {showFormulabar ? (
            <Formulabar
              value={formulaInput}
              onChange={handleFormulabarChange}
              onKeyDown={handleFormulabarKeydown}
              onFocus={handleFormulabarFocus}
            />
          ) : null}
          <Workbook
            scale={scale}
            StatusBar={StatusBar}
            showTabStrip={showTabStrip}
            isTabEditable={isTabEditable}
            allowNewSheet={allowNewSheet}
            onResize={handleResize}
            formatter={formatter}
            ref={currentGrid}
            onDelete={handleDelete}
            onFill={handleFill}
            onActiveCellValueChange={handleActiveCellValueChange}
            onActiveCellChange={handleActiveCellChange}
            currentSheet={currentSheet}
            selectedSheet={selectedSheet}
            onChangeSelectedSheet={setSelectedSheet}
            onNewSheet={handleNewSheet}
            theme={theme}
            sheets={sheets}
            onChange={handleChange}
            onSheetChange={handleSheetAttributesChange}
            minColumnWidth={minColumnWidth}
            minRowHeight={minRowHeight}
            CellRenderer={CellRenderer}
            HeaderCellRenderer={HeaderCellRenderer}
            onChangeSheetName={handleChangeSheetName}
            onDeleteSheet={handleDeleteSheet}
            onDuplicateSheet={handleDuplicateSheet}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCut={handleCut}
            onCopy={handleCopy}
            onInsertRow={handleInsertRow}
            onInsertColumn={handleInsertColumn}
            onDeleteRow={handleDeleteRow}
            onDeleteColumn={handleDeleteColumn}
            CellEditor={CellEditor}
            onSelectionChange={onSelectionChange}
            selectionMode={selectionMode}
            onChangeFilter={handleChangeFilter}
            showStatusBar={showStatusBar}
            selectionPolicy={selectionPolicy}
            ContextMenu={ContextMenu}
            snap={snap}
            Tooltip={Tooltip}
            onHideSheet={handleHideSheet}
            onShowSheet={handleShowSheet}
            onProtectSheet={handleProtectSheet}
            onUnProtectSheet={handleUnProtectSheet}
            onChangeTabColor={handleChangeTabColor}
            rowHeaderWidth={rowHeaderWidth}
            columnHeaderHeight={columnHeaderHeight}
            gridLineColor={gridLineColor}
            gridBackgroundColor={gridBackgroundColor}
          />
        </Flex>
      </>
    );
  })
);

export interface SpreadSheetPropsWithTheme extends SpreadSheetProps {
  theme?: ThemeType;
  initialColorMode?: "light" | "dark";
}
const ThemeWrapper: React.FC<
  SpreadSheetPropsWithTheme & RefAttributeSheetGrid
> = forwardRef((props, forwardedRef) => {
  const {
    theme: defaultTheme = theme,
    initialColorMode = "light",
    ...rest
  } = props;
  return (
    <ThemeProvider theme={defaultTheme}>
      <ColorModeProvider value={initialColorMode}>
        <Spreadsheet {...rest} ref={forwardedRef} />
      </ColorModeProvider>
    </ThemeProvider>
  );
});

export default ThemeWrapper;
