import {DOMRefValue} from '@react-types/shared';
import {HoverResponder, PressResponder} from '@react-aria/interactions';
import {Overlay} from '@react-spectrum/overlays';
import {PositionProps, useOverlayPosition} from '@react-aria/overlays';
import React, {Fragment, ReactElement, RefObject, useRef} from 'react';
import {unwrapDOMRef} from '@react-spectrum/utils';
import {useControlledState} from '@react-stately/utils';
import {useTooltipState} from '@react-stately/tooltip';
import {useTooltipTrigger} from '@react-aria/tooltip';

interface TooltipTriggerProps extends PositionProps {
  children: ReactElement[],
  type?: 'click',
  targetRef?: RefObject<HTMLElement>,
  isOpen?: boolean,
  defaultOpen?: boolean,
  isDisabled?: boolean,
  onOpenChange?: (isOpen: boolean) => void
}

export function TooltipTrigger(props: TooltipTriggerProps) {
  let {
    children,
    type,
    targetRef,
    isOpen,
    defaultOpen,
    isDisabled,
    onOpenChange
  } = props;

  let [trigger, content] = React.Children.toArray(children);

  let state = useTooltipState(props);

  // TODO: move to useTooltipTrigger because they are interactions
  let onPressInteraction = () => {
    state.setOpen(!state.open);
  };

  let onHoverInteraction = (isHovering) => {
    state.setOpen(isHovering);
  };

  let onClose = () => {
    state.setOpen(false);
  };

  let containerRef = useRef<DOMRefValue<HTMLDivElement>>();
  let triggerRef = useRef<HTMLElement>();
  let overlayRef = useRef<HTMLDivElement>();

  let {tooltipTriggerBaseProps} = useTooltipTrigger({
    tooltipProps: {
      ...content.props,
      onClose
    },
    triggerProps: {
      ...trigger.props,
      ref: triggerRef
    },
    state: {
      // open,
      // setOpen
      state
    }
  });

  let {overlayProps, placement, arrowProps} = useOverlayPosition({
    placement: props.placement,
    containerRef: unwrapDOMRef(containerRef),
    targetRef: targetRef || triggerRef,
    overlayRef,
    isOpen
  });

  delete overlayProps.style.position;

  let overlay = (
    <Overlay isOpen={state.open} ref={containerRef}>
      {React.cloneElement(content, {placement: placement, arrowProps: arrowProps, ref: overlayRef, UNSAFE_style: {...overlayProps.style}, isOpen: open})}
    </Overlay>
  );

  if (type === 'click') {
    return (
      <Fragment>
        <PressResponder
          {...tooltipTriggerBaseProps}
          ref={triggerRef}
          isPressed={isOpen}
          isDisabled={isDisabled}
          onPress={onPressInteraction}>
          {trigger}
        </PressResponder>
        {overlay}
      </Fragment>
    );
  } else if (type === 'hover') {
    return (
      <Fragment>
        <HoverResponder
          {...tooltipTriggerBaseProps}
          ref={triggerRef}
          isDisabled={isDisabled}
          onShow={onHoverInteraction}
          onHoverTooltip={onHoverInteraction}>
          {trigger}
          {overlay}
        </HoverResponder>
      </Fragment>
    );
  }
}
