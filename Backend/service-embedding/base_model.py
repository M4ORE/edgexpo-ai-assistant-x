#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple base model classes to replace qai_hub_models dependencies
"""

from __future__ import annotations
from typing import Protocol, TypeVar, Any
import torch
from torch import nn
from enum import Enum


class ExecutableModelProtocol(Protocol[TypeVar("T")]):
    """Protocol for executable models"""
    def __call__(self, *args, **kwargs) -> Any:
        ...


class BaseModel(nn.Module):
    """Base model class"""
    
    def __init__(self):
        super().__init__()
    
    @classmethod
    def from_pretrained(cls, *args, **kwargs):
        raise NotImplementedError


class TargetRuntime(Enum):
    """Target runtime enum"""
    TFLITE = "tflite"
    ONNX = "onnx"
    QNN = "qnn"


class Precision(Enum):
    """Precision enum"""
    FLOAT = "float"
    W8A8 = "w8a8"
    W8A16 = "w8a16"
    
    @classmethod
    def parse(cls, value: str):
        return cls[value.upper()]


class EvalMode(Enum):
    """Evaluation mode enum"""
    FP = "fp"
    ON_DEVICE = "on_device"
    LOCAL_DEVICE = "local_device"
    QUANTSIM = "quantsim"
    
    @property
    def description(self):
        descriptions = {
            "FP": "Floating point evaluation",
            "ON_DEVICE": "On-device evaluation",
            "LOCAL_DEVICE": "Local device evaluation",
            "QUANTSIM": "Quantized simulation"
        }
        return descriptions.get(self.value, "")
    
    @classmethod
    def from_string(cls, value: str):
        return cls[value.upper()]


InputSpec = dict[str, tuple[tuple[int, ...], str]]