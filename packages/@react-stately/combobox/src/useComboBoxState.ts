/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */


import {CollectionBase, SingleSelection} from '@react-types/shared';
import {Node, TreeCollection} from '@react-stately/collections';
import {SelectState} from '@react-stately/select';
import {useControlledState} from '@react-stately/utils';
import {useEffect, useMemo, useRef} from 'react';
import {useSelectState} from '@react-stately/select';

export interface ComboBoxState<T> extends SelectState<T> {
  value: string,
  setValue: (value: string) => void
}

interface ComboBoxProps<T> extends CollectionBase<T>, SingleSelection {
  isOpen?: boolean,
  defaultOpen?: boolean,
  onOpenChange?: (isOpen: boolean) => void,
  inputValue?: string,
  defaultInputValue?: string,
  onInputChange?: (value: string) => void,
  onFilter?: (value: string) => void,
  isFocused: boolean,
  collator: Intl.Collator
}

function filter<T>(nodes: Iterable<Node<T>>, filterFn: (node: Node<T>) => boolean) {
  let filteredNode = [];
  for (let node of nodes) {
    if (node.type === 'section' && node.hasChildNodes) {
      let copyOfNode = {...node};
      let copyOfChildNodes = copyOfNode.childNodes;
      let filtered = filter(copyOfChildNodes, filterFn);
      if ([...filtered].length > 0) {
        copyOfNode.childNodes = filtered;
        filteredNode.push(copyOfNode);
      }
    } else if (node.type !== 'section' && filterFn(node)) {
      filteredNode.push(node);
    }
  }
  return filteredNode;
}

export function useComboBoxState<T extends object>(props: ComboBoxProps<T>): ComboBoxState<T> {
  let {
    onFilter,
    isFocused,
    isOpen,
    defaultOpen,
    collator
  } = props;

  let itemsControlled = !!onFilter;

  // Create a separate menu open state tracker so onOpenChange doesn't fire with open and close in quick succession
  // in cases where there aren't items to show
  // Note that this means onOpenChange won't fire for controlled open states
  let [menuIsOpen, setMenuIsOpen] = useControlledState(isOpen, defaultOpen || false, () => {});



  // Problem: cannot pass in selectedKey: computeKeyFromValue(inputValue, collection) since collection doesn't exist till useSelectState is done
  // let selectState = useSelectState({...props, selectedKey: computeKeyFromValue(inputValue)});
  let selectState = useSelectState({...props, onSelectionChange: undefined});
  
  // Problem: selectState.collection is actively filtered and thus sometimes makes key lookup return null (especially since onInputChange happens before the filtering finishes)
  // Copied selectState.collection so lookup isn't impeded 
  let originalCollection = {...selectState.collection};
  
  let computeKeyFromValue = (value, collection) => {
    let key;
    for (let item of collection.iterable) {
      let itemText = item.textValue;
      if (itemText === value) {
        key = item.key;
        break;
      }
    }

    return key;
  }

  // replacement setSelectedKey util function that calls setInputValue based off of key provided
  let setSelectedKey = (key) => {
    let item = selectState.collection.getItem(key);
    let itemText = item ? item.textValue : '';
    setInputValue(itemText);
  }

  // Add a function that takes new input value, calculates the corresponding key, compares that with the previously calculated
  // key, then fires onSelectionChange if different
  let onInputChange = (value) => {
    if (props.onInputChange) {
      props.onInputChange(value);
    }


    // compute selected key off of value
    // compared selected key with previous selected key (TODO how to get old selectedKey, right now I'm using selectState.selectedKey)
    // if different, fire onSelectionChange(new key)
    let newSelectedKey = computeKeyFromValue(value, originalCollection);
    // console.log('selectState.selectedKey', selectState.selectedKey, newSelectedKey, value, selectState.collection);


    if (newSelectedKey !== selectState.selectedKey) {
      if (props.onSelectionChange) {
        props.onSelectionChange(newSelectedKey);
      }
    }
  }

  let [inputValue, setInputValue] = useControlledState(toString(props.inputValue), toString(props.defaultInputValue) || '', onInputChange);
  let selectedKeyText = selectState.selectedItem ? selectState.selectedItem.textValue : undefined;

  if (props.selectedKey && props.inputValue) {
    let selectedItem = selectState.collection.getItem(props.selectedKey);
    let itemText = selectedItem ? selectedItem.textValue : '';
    if (itemText !== props.inputValue) {
      throw new Error('Mismatch between selected item and inputValue!');
    }  
  }

  // TODO: rename to inputValue
  let value;
  // Set value equal to whatever controlled prop exists (selectedKey or inputValue)
  // If neither exist, set equal to inputValue 
  if (props.selectedKey) {
    value = selectedKeyText || '';
  } else if (props.inputValue) {
    value = inputValue;
  } else {
    value = inputValue || selectedKeyText || '';
  }

  // if inputValue matches a key, update the selectedKeystate (this is for typing)
  // Also clears the selected key if inputValue doesn't match any keys
  useEffect(() => {
    let key = computeKeyFromValue(inputValue, originalCollection);
    selectState.setSelectedKey(key);
  }, [inputValue, selectState.collection, props.onSelectionChange])
  
  // Problem: clicking on menu items doesn't call our selectedKey function so the inputValue doesn't update
  // The below fixes it by watching for a selectedKey change and calling our setSelectedKey function for it
  // Problem: doesn't call onSelection change though since the newKey == selectedKey in setSelectedKey
  // Possible solution: don't do a "different key check" in onInputChange for deciding to call onSelection
  useEffect(() => {
    selectState.selectedKey && setSelectedKey(selectState.selectedKey);
  }, [selectState.selectedKey])
  // console.log('selectionManager', selectState.selectionManager);

  // Problem: Hitting enter to select a menu item doesn't close the menu
  // Possible solution is to add back .close to the Enter key down in useComboBox
  // Then add a useEffect watching props.selectedKey that closes the menu if it is open and the selectedKey prop changes 



  let lowercaseValue = value.toLowerCase().replace(' ', '');

  let defaultFilterFn = useMemo(() => (node: Node<T>) => {
    let scan = 0;
    let lowercaseNode = node.textValue.toLowerCase().replace(' ', '');
    let sliceLen = lowercaseValue.length;
    let match = false;

    for (; scan + sliceLen <= lowercaseNode.length && !match; scan++) {
      let nodeSlice = lowercaseNode.slice(scan, scan + sliceLen);
      let compareVal = collator.compare(lowercaseValue, nodeSlice);
      if (compareVal === 0) {
        match = true;
      }
    }

    return match;
  }, [collator, lowercaseValue]);

  let lastValue = useRef('');
  useEffect(() => {
    if (onFilter && lastValue.current !== value) {
      onFilter(value);
    }

    lastValue.current = value;
  }, [value, onFilter]);

  selectState.collection = useMemo(() => {
    if (itemsControlled || value === '') {
      return selectState.collection;
    }
    return new TreeCollection(filter(selectState.collection, defaultFilterFn), new Set());
  }, [selectState.collection, value, itemsControlled, defaultFilterFn]);

  useEffect(() => {
    // Close the menu if it was open but there aren't any items to display
    if (menuIsOpen && selectState.collection.size === 0) {
      selectState.close();
    }

    // Only open the menu if there are items to display and the combobox is focused
    // Note: doesn't affect controlled isOpen or defaultOpen
    if (isFocused && menuIsOpen && selectState.collection.size > 0) {
      selectState.open();
    }

    // Close the menu if it is supposed to be closed
    if (!menuIsOpen) {
      selectState.close();
    }

    // Maybe change dep array back to selectState? or make it selectState.close?
  }, [menuIsOpen, selectState.collection, selectState, isFocused]);

  let open = () => {
    setMenuIsOpen(true);
  };

  let close = () => {
    setMenuIsOpen(false);
  };

  let toggle = (focusStrategy = null) => {
    setMenuIsOpen(state => !state);
    selectState.setFocusStrategy(focusStrategy);
  };

  return {
    ...selectState,
    open,
    close,
    toggle,
    value,
    setValue: setInputValue,
    setSelectedKey
  };
}

function toString(val) {
  if (val == null) {
    return;
  }

  return val.toString();
}
